import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useCatalogPublication, isCatalogPublicationDeferred } from "@/hooks/use-catalog-publication";
import { createMenuItem, updateMenuItem, deleteMenuItem } from "@/lib/menu-items";
import { updateOwnedRestaurant, createOnboarding } from "@/lib/restaurants";
import { vaptApiRequest } from "@/lib/vapt-api-client";
const env = vi.hoisted(() => ({ publicCatalogEventsEnabled: true }));
vi.mock("@/lib/env", () => ({ ENV: env }));
vi.mock("@/lib/vapt-api-client", async original => ({ ...(await original<typeof import("@/lib/vapt-api-client")>()), vaptApiRequest: vi.fn() }));
const itemId = "33333333-3333-4333-8333-333333333333";
const restaurantId = "22222222-2222-4222-8222-222222222222";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("owner adapters use the receipt lifecycle, never cast202 into domain data", () => {
  it("item update and restaurant/onboarding adapters resolve known resources only after ready", async () => {
    const item = { id: itemId, name: "Prato" }; const restaurant = { id: restaurantId, name: "Bistrô" };
    vi.mocked(vaptApiRequest).mockImplementation(async input => {
      if (input.method === "GET") return (input.route.endsWith("menu-items") ? [item] : restaurant) as never;
      return { receipt: { operationId: input.headers?.["Idempotency-Key"], restaurantId, phase: "ready", version: "12", committed: true, retryable: false } } as never;
    });
    const { result } = renderHook(() => useCatalogPublication("owner"));
    let saved: unknown;
    await act(async () => { saved = await updateMenuItem(itemId, { available: false }, result.current); }); expect(saved).toEqual(item);
    await act(async () => { saved = await updateOwnedRestaurant({ name: "Bistrô" }, result.current); }); expect(saved).toEqual(restaurant);
    await act(async () => { saved = await createOnboarding({ restaurantName: "Bistrô", slug: "bistro", dishName: "Prato", dishPrice: "12" }, result.current); }); expect(saved).toEqual(restaurant);
    await act(async () => { await deleteMenuItem(itemId, result.current); });
    expect(vi.mocked(vaptApiRequest).mock.calls.filter(([value]) => value.headers?.["X-Vapt-Catalog-Protocol"] === "1")).toHaveLength(4);
  });
  it("pending item delete is deferred and cannot be treated as successful deletion", async () => {
    vi.mocked(vaptApiRequest).mockImplementation(async input => ({ receipt: { operationId: input.headers?.["Idempotency-Key"], restaurantId,
      phase: "committed", version: "12", committed: true, retryable: true } }) as never);
    const { result } = renderHook(() => useCatalogPublication("owner")); let caught: unknown;
    await act(async () => { try { await deleteMenuItem(itemId, result.current); } catch (error) { caught = error; } });
    expect(isCatalogPublicationDeferred(caught)).toBe(true); expect(result.current.blocked).toBe(true);
  });
  it("missing creation result reloads the owner's list but never guesses an item to attach an image to", async () => {
    const reload = vi.fn(); const { result } = renderHook(() => useCatalogPublication("owner", reload));
    vi.mocked(vaptApiRequest).mockImplementation(async input => ({ receipt: { operationId: input.headers?.["Idempotency-Key"], restaurantId,
      phase: "ready", version: "12", committed: true, retryable: false } }) as never);
    await act(async () => { await expect(createMenuItem({ name: "Prato" } as never, result.current)).rejects.toMatchObject({ code: "catalog_result_unavailable" }); });
    expect(reload).toHaveBeenCalledOnce(); expect(result.current.receipt?.phase).toBe("ready");
  });
});
