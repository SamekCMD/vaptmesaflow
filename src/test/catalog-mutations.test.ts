import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCatalogMutation, getCatalogOperation, retryCatalogOperation } from "@/lib/catalog-mutations";
import { vaptApiRequest } from "@/lib/vapt-api-client";
import type { CommandReceipt } from "@/lib/catalog/contracts";

const environment = vi.hoisted(() => ({ publicCatalogEventsEnabled: true, publicCatalogWriterEnabled: false }));
vi.mock("@/lib/env", () => ({ ENV: environment }));
vi.mock("@/lib/vapt-api-client", async original => ({ ...(await original<typeof import("@/lib/vapt-api-client")>()), vaptApiRequest: vi.fn() }));
const operationId = "11111111-1111-4111-8111-111111111111";
const restaurantId = "22222222-2222-4222-8222-222222222222";
const receipt: CommandReceipt = { operationId, restaurantId, phase: "committed", version: "9007199254740993", committed: true, retryable: true };
beforeEach(() => { vi.clearAllMocks(); environment.publicCatalogEventsEnabled = true; environment.publicCatalogWriterEnabled = false; });
afterEach(() => vi.restoreAllMocks());
describe("owner catalog mutation protocol", () => {
  it('canonical mutation receipts cannot identify a different restaurant from the explicit route',async()=>{
    vi.mocked(vaptApiRequest).mockResolvedValue({receipt:{...receipt,restaurantId:'33333333-3333-4333-8333-333333333333'}});
    await expect(runCatalogMutation({operationId,method:'PATCH',route:'/restaurants/'+restaurantId,body:{name:'A'}}))
      .rejects.toMatchObject({code:'catalog_protocol_invalid'});
  });
  it("keeps authenticated status and writes on the protocol when only the reader is rolled back", async () => {
    environment.publicCatalogEventsEnabled = false; environment.publicCatalogWriterEnabled = true;
    vi.mocked(vaptApiRequest).mockResolvedValueOnce({ receipt }).mockResolvedValueOnce(receipt);
    expect((await runCatalogMutation({ operationId, method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: {} })).receipt).toEqual(receipt);
    expect(await getCatalogOperation(restaurantId, operationId)).toEqual(receipt);
  });
  it("returns committed-not-ready without pretending it is a DTO or scheduling status polling", async () => {
    vi.mocked(vaptApiRequest).mockResolvedValue({ receipt });
    const result = await runCatalogMutation({ operationId, method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: { name: "Bistrô" } });
    expect(result).toEqual({ receipt }); expect(result).not.toHaveProperty("result"); expect(vaptApiRequest).toHaveBeenCalledTimes(1);
    expect(vaptApiRequest).toHaveBeenCalledWith({ method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: { name: "Bistrô" }, requireAuth: true,
      headers: { "X-Vapt-Catalog-Protocol": "1", "Idempotency-Key": operationId } });
  });
  it("repeating the same action retains its operation key; the image attachment PATCH uses a different key", async () => {
    const second = "33333333-3333-4333-8333-333333333333";
    vi.mocked(vaptApiRequest).mockResolvedValueOnce({ receipt }).mockResolvedValueOnce({ receipt }).mockResolvedValueOnce({ receipt: { ...receipt, operationId: second } });
    const first = { operationId, method: "POST" as const, route: "/restaurants/22222222-2222-4222-8222-222222222222/menu-items", body: { name: "Prato" } };
    await runCatalogMutation(first); await runCatalogMutation(first);
    await runCatalogMutation({ operationId: second, method: "PATCH", route: `/restaurants/22222222-2222-4222-8222-222222222222/menu-items/${restaurantId}`, body: { imageUrl: "https://assets.test/synthetic.webp" } });
    expect(vi.mocked(vaptApiRequest).mock.calls.map(([value]) => value.headers?.["Idempotency-Key"])).toEqual([operationId, operationId, second]);
  });
  it("status and retry are explicit authenticated receipt-only operations using the original operation", async () => {
    vi.mocked(vaptApiRequest).mockResolvedValue(receipt);
    expect(await getCatalogOperation(restaurantId, operationId)).toEqual(receipt); expect(await retryCatalogOperation(restaurantId, operationId)).toEqual(receipt);
    expect(vi.mocked(vaptApiRequest).mock.calls.map(([value]) => value)).toEqual([
      { method: "GET", route: `/restaurants/22222222-2222-4222-8222-222222222222/catalog-operations/${operationId}`, requireAuth: true },
      { method: "POST", route: `/restaurants/22222222-2222-4222-8222-222222222222/catalog-operations/${operationId}/retry`, requireAuth: true, body: {} },
    ]);
  });
  it("rejects mismatched or impossible receipts and never leaks validation details", async () => {
    for (const bad of [{ ...receipt, operationId: restaurantId }, { ...receipt, phase: "ready", committed: false }, { ...receipt, version: "01" },
      { ...receipt, phase: "accepted", committed: true }, { ...receipt, private: "must-not-escape" }]) {
      vi.mocked(vaptApiRequest).mockResolvedValue({ receipt: bad });
      await expect(runCatalogMutation({ operationId, method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: {} })).rejects.toMatchObject({ code: "catalog_protocol_invalid" });
    }
  });
  it("ready may omit result; private-only ready may omit a public revision", async () => {
    vi.mocked(vaptApiRequest).mockResolvedValue({ receipt: { ...receipt, phase: "ready", retryable: false, version: null } });
    expect((await runCatalogMutation({ operationId, method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: { cnpj: null } })).receipt.version).toBeNull();
    vi.mocked(vaptApiRequest).mockResolvedValue({ receipt: { ...receipt, phase: "ready", retryable: false } });
    expect((await runCatalogMutation({ operationId, method: "DELETE", route: `/restaurants/22222222-2222-4222-8222-222222222222/menu-items/${restaurantId}` })).result).toBeUndefined();
  });
  it("disabled rollout and invalid IDs cannot create writes; network failure is never automatically replayed", async () => {
    environment.publicCatalogEventsEnabled = false;
    await expect(runCatalogMutation({ operationId, method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: {} })).rejects.toMatchObject({ code: "catalog_protocol_disabled" });
    environment.publicCatalogEventsEnabled = true;
    await expect(getCatalogOperation(restaurantId, "../other")).rejects.toMatchObject({ code: "invalid_operation_id" }); expect(vaptApiRequest).not.toHaveBeenCalled();
    vi.mocked(vaptApiRequest).mockRejectedValue(new Error("Synthetic network failure"));
    await expect(runCatalogMutation({ operationId, method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: {} })).rejects.toThrow("Synthetic network failure");
    expect(vaptApiRequest).toHaveBeenCalledTimes(1);
  });
});
