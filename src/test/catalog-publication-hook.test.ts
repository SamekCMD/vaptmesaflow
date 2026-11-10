import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCatalogPublication, isCatalogPublicationDeferred } from "@/hooks/use-catalog-publication";
import { getCatalogOperation, retryCatalogOperation, runCatalogMutation } from "@/lib/catalog-mutations";
import type { CommandReceipt } from "@/lib/catalog/contracts";
import { VaptApiClientError } from "@/lib/vapt-api-client";
const env = vi.hoisted(() => ({ publicCatalogEventsEnabled: true, publicCatalogWriterEnabled: false }));
vi.mock("@/lib/env", () => ({ ENV: env }));
vi.mock("@/lib/catalog-mutations", () => ({ runCatalogMutation: vi.fn(), getCatalogOperation: vi.fn(), retryCatalogOperation: vi.fn() }));
const identity = {userId:"owner",restaurantId:"22222222-2222-4222-8222-222222222222"};
const receipt = (operationId: string, phase: CommandReceipt["phase"] = "committed"): CommandReceipt => ({ operationId,
  restaurantId: "22222222-2222-4222-8222-222222222222", phase, version: phase === "accepted" ? null : "12", committed: phase !== "accepted", retryable: phase !== "ready" });
beforeEach(() => { vi.resetAllMocks(); env.publicCatalogEventsEnabled = true; env.publicCatalogWriterEnabled = false; });
afterEach(cleanup);
describe("owner publication lifecycle", () => {
  it('operation controls retain restaurantA and discard recovery when the same user selectsB',async()=>{
    env.publicCatalogWriterEnabled=true;
    const restaurantId='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
    const identityA={userId:'owner',restaurantId},identityB={userId:'owner',restaurantId:other};
    vi.mocked(runCatalogMutation).mockImplementation(async input=>({receipt:receipt(input.operationId)}));
    const {result,rerender}=renderHook(({identity})=>useCatalogPublication(identity),{initialProps:{identity:identityA}});
    await act(async()=>{await expect(result.current.run({method:'PATCH',route:'/restaurants/'+restaurantId,body:{name:'A'}})).rejects.toThrow();});
    const operationId=result.current.operationId!;vi.mocked(getCatalogOperation).mockResolvedValue(receipt(operationId));
    await act(async()=>{await result.current.check();});
    expect(getCatalogOperation).toHaveBeenCalledWith(restaurantId,operationId,expect.any(AbortSignal));
    rerender({identity:identityB});expect(result.current.operationId).toBeNull();
    await act(async()=>{await result.current.retry();});expect(retryCatalogOperation).not.toHaveBeenCalled();
  });
  it.each(["create", "private-patch"])("explicitly replays %s after verified not-admitted404 using the same frozen action and key", async kind => {
    const published = vi.fn();
    vi.mocked(runCatalogMutation).mockRejectedValueOnce(new Error("Request lost before admission"))
      .mockImplementationOnce(async input => ({ receipt: { ...receipt(input.operationId, "ready"), version: kind === "private-patch" ? null : "12" } }));
    const { result, unmount } = renderHook(() => useCatalogPublication(identity, published));
    const body = kind === "create" ? { name: "Original item" } : { cnpj: "synthetic-private-value" };
    await act(async () => { await expect(result.current.run({ method: kind === "create" ? "POST" : "PATCH", route: kind === "create" ? "/restaurants/22222222-2222-4222-8222-222222222222/menu-items" : "/restaurants/22222222-2222-4222-8222-222222222222", body })).rejects.toThrow(); });
    const operationId = result.current.operationId;
    body.name = "Different edited value";
    vi.mocked(getCatalogOperation).mockRejectedValue(new VaptApiClientError("catalog_operation_not_found", "Not found", 404));
    await act(async () => { await result.current.check(); });
    expect(result.current.canReplay).toBe(true);
    expect(runCatalogMutation).toHaveBeenCalledOnce();
    await act(async () => { await result.current.retry(); });
    expect(runCatalogMutation).toHaveBeenCalledTimes(2);
    expect(vi.mocked(runCatalogMutation).mock.calls[1]![0].operationId).toBe(operationId);
    expect(vi.mocked(runCatalogMutation).mock.calls[1]![0].body).toEqual(kind === "create" ? { name: "Original item" } : { cnpj: "synthetic-private-value" });
    expect(result.current.blocked).toBe(false); expect(published).toHaveBeenCalledOnce();
    expect(retryCatalogOperation).not.toHaveBeenCalled(); unmount();
  });
  it("same-action recovery is discarded at logout and never becomes an automatic resend", async () => {
    vi.mocked(runCatalogMutation).mockRejectedValue(new Error("Request lost"));
    vi.mocked(getCatalogOperation).mockRejectedValue(new VaptApiClientError("catalog_operation_not_found", "Not found", 404));
    const { result, rerender } = renderHook(({ owner }) => useCatalogPublication(owner ? {...identity,userId:owner} : null), { initialProps: { owner: "owner" as string | undefined } });
    await act(async () => { await expect(result.current.run({ method: "POST", route: "/restaurants/22222222-2222-4222-8222-222222222222/onboarding/finalize", body: {} })).rejects.toThrow(); await result.current.check(); });
    expect(result.current.canReplay).toBe(true);
    rerender({ owner: undefined });
    await act(async () => { await result.current.retry(); });
    expect(result.current.canReplay).toBe(false); expect(runCatalogMutation).toHaveBeenCalledOnce();
  });
  it("retains an uncertain payload only in memory for at most24h, without polling or automatic replay", async () => {
    vi.useFakeTimers();
    vi.mocked(runCatalogMutation).mockRejectedValue(new Error("Request lost"));
    vi.mocked(getCatalogOperation).mockRejectedValue(new VaptApiClientError("catalog_operation_not_found", "Not found", 404));
    const { result, unmount } = renderHook(() => useCatalogPublication(identity));
    try {
      await act(async () => { await expect(result.current.run({ method: "POST", route: "/restaurants/22222222-2222-4222-8222-222222222222/onboarding/finalize", body: {} })).rejects.toThrow(); await result.current.check(); });
      expect(result.current.canReplay).toBe(true);
      await act(async () => { await vi.advanceTimersByTimeAsync(86_400_000); });
      expect(result.current.canReplay).toBe(false);
      await act(async () => { await result.current.retry(); });
      expect(runCatalogMutation).toHaveBeenCalledOnce(); expect(getCatalogOperation).toHaveBeenCalledOnce();
    } finally { unmount(); vi.useRealTimers(); }
  });
  it("reader rollback keeps accepted operations locked and manually recoverable", async () => {
    env.publicCatalogEventsEnabled = false; env.publicCatalogWriterEnabled = true;
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: receipt(input.operationId) }));
    const { result } = renderHook(() => useCatalogPublication(identity));
    await act(async () => { try { await result.current.run({ method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: {} }); } catch { /* Publication remains pending. */ } });
    expect(runCatalogMutation).toHaveBeenCalledOnce(); expect(result.current.blocked).toBe(true);
    const key = result.current.operationId!; vi.mocked(getCatalogOperation).mockResolvedValue(receipt(key, "ready"));
    await act(async () => { await result.current.check(); }); expect(getCatalogOperation).toHaveBeenCalledWith(identity.restaurantId,key, expect.any(AbortSignal)); expect(result.current.blocked).toBe(false);
  });
  it("locks conflicting actions after acceptance, with no automatic status/retry", async () => {
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: receipt(input.operationId) }));
    const { result } = renderHook(() => useCatalogPublication(identity));
    let error: unknown;
    await act(async () => { try { await result.current.run({ method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: { name: "Bistrô" } }); } catch (value) { error = value; } });
    expect(isCatalogPublicationDeferred(error)).toBe(true); expect(result.current.blocked).toBe(true); expect(result.current.receipt?.phase).toBe("committed");
    await act(async () => { await expect(result.current.run({ method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: {} })).rejects.toThrow(); });
    expect(runCatalogMutation).toHaveBeenCalledOnce(); expect(getCatalogOperation).not.toHaveBeenCalled(); expect(retryCatalogOperation).not.toHaveBeenCalled();
  });
  it("manual status/retry uses the original key and reloads only on ready", async () => {
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: receipt(input.operationId) }));
    const published = vi.fn(); const { result } = renderHook(() => useCatalogPublication(identity, published));
    await act(async () => { try { await result.current.run({ method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: {} }); } catch { /* Accepted operation intentionally remains pending. */ } });
    const key = vi.mocked(runCatalogMutation).mock.calls[0]![0].operationId;
    vi.mocked(getCatalogOperation).mockResolvedValue(receipt(key)); vi.mocked(retryCatalogOperation).mockResolvedValue(receipt(key, "ready"));
    await act(async () => { await result.current.check(); }); expect(getCatalogOperation).toHaveBeenCalledWith(identity.restaurantId,key, expect.any(AbortSignal)); expect(published).not.toHaveBeenCalled();
    await act(async () => { await result.current.retry(); }); expect(retryCatalogOperation).toHaveBeenCalledWith(identity.restaurantId,key, expect.any(AbortSignal)); expect(published).toHaveBeenCalledOnce(); expect(result.current.blocked).toBe(false);
  });
  it("ready without a private result uses one explicit resource reload, not another mutation", async () => {
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: receipt(input.operationId, "ready") }));
    const reload = vi.fn().mockResolvedValue({ id: "saved" }); const { result } = renderHook(() => useCatalogPublication(identity));
    let saved: unknown; await act(async () => { saved = await result.current.run({ method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: {} }, reload); });
    expect(saved).toEqual({ id: "saved" }); expect(reload).toHaveBeenCalledOnce(); expect(runCatalogMutation).toHaveBeenCalledOnce();
  });
  it("sequential actions get different keys, including the image's second PATCH", async () => {
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: receipt(input.operationId, "ready"), result: { id: "saved" } }));
    const { result } = renderHook(() => useCatalogPublication(identity));
    await act(async () => { await result.current.run({ method: "POST", route: "/restaurants/22222222-2222-4222-8222-222222222222/menu-items", body: {} });
      await result.current.run({ method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222/menu-items/33333333-3333-4333-8333-333333333333", body: { imageUrl: "https://assets.test/file.webp" } }); });
    const keys = vi.mocked(runCatalogMutation).mock.calls.map(([value]) => value.operationId); expect(keys[0]).not.toBe(keys[1]);
  });
  it("logout cancels transport, ignores late results and never runs a continuation or retry", async () => {
    let finish!: (value: unknown) => void; vi.mocked(runCatalogMutation).mockImplementation(input => new Promise(resolve => { finish = () => resolve({ receipt: receipt(input.operationId, "ready"), result: {} }); }));
    const reload = vi.fn(); const { result, rerender } = renderHook(({ owner }) => useCatalogPublication(owner ? {...identity,userId:owner} : null), { initialProps: { owner: "owner" as string | undefined } });
    let pending: Promise<unknown>; act(() => { pending = result.current.run({ method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: {} }, reload).catch(error => error); });
    const signal = vi.mocked(runCatalogMutation).mock.calls[0]![0].signal; rerender({ owner: undefined }); expect(signal?.aborted).toBe(true);
    await act(async () => { finish({}); await pending; }); expect(result.current.receipt).toBeNull(); expect(reload).not.toHaveBeenCalled();
    await act(async () => { await result.current.retry(); }); expect(retryCatalogOperation).not.toHaveBeenCalled();
  });
  it("ambiguous transport errors stay locked for manual verification, never auto-replay", async () => {
    vi.mocked(runCatalogMutation).mockRejectedValue(new Error("Synthetic lost response")); const { result } = renderHook(() => useCatalogPublication(identity));
    await act(async () => { await expect(result.current.run({ method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: {} })).rejects.toThrow(); });
    expect(result.current.uncertain).toBe(true); expect(result.current.blocked).toBe(true); expect(runCatalogMutation).toHaveBeenCalledOnce();
    expect(getCatalogOperation).not.toHaveBeenCalled();
  });
  it("a definitive blocked, uncommitted, non-retryable command does not lock all future editing", async () => {
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: { ...receipt(input.operationId, "blocked"), committed: false, version: null, retryable: false } }));
    const { result } = renderHook(() => useCatalogPublication(identity));
    await act(async () => { try { await result.current.run({ method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: {} }); } catch { /* Definitive failure, no domain commit. */ } });
    expect(result.current.receipt?.phase).toBe("blocked"); expect(result.current.blocked).toBe(false);
  });
  it("a resource reload failure after ready never claims that publication failed", async () => {
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: receipt(input.operationId) }));
    const { result } = renderHook(() => useCatalogPublication(identity, async () => { throw new Error("Synthetic reload failure"); }));
    await act(async () => { try { await result.current.run({ method: "PATCH", route: "/restaurants/22222222-2222-4222-8222-222222222222", body: {} }); } catch { /* Pending publication. */ } });
    const key = vi.mocked(runCatalogMutation).mock.calls[0]![0].operationId; vi.mocked(getCatalogOperation).mockResolvedValue(receipt(key, "ready"));
    await act(async () => { await result.current.check(); });
    expect(result.current.receipt?.phase).toBe("ready"); expect(result.current.error).toBe("Publicada, mas não foi possível recarregar os dados.");
  });
});
