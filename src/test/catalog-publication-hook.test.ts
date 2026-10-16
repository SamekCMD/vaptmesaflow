import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCatalogPublication, isCatalogPublicationDeferred } from "@/hooks/use-catalog-publication";
import { getCatalogOperation, retryCatalogOperation, runCatalogMutation } from "@/lib/catalog-mutations";
import type { CommandReceipt } from "@/lib/catalog/contracts";
const env = vi.hoisted(() => ({ publicCatalogEventsEnabled: true, publicCatalogWriterEnabled: false }));
vi.mock("@/lib/env", () => ({ ENV: env }));
vi.mock("@/lib/catalog-mutations", () => ({ runCatalogMutation: vi.fn(), getCatalogOperation: vi.fn(), retryCatalogOperation: vi.fn() }));
const receipt = (operationId: string, phase: CommandReceipt["phase"] = "committed"): CommandReceipt => ({ operationId,
  restaurantId: "22222222-2222-4222-8222-222222222222", phase, version: phase === "accepted" ? null : "12", committed: phase !== "accepted", retryable: phase !== "ready" });
beforeEach(() => { vi.resetAllMocks(); env.publicCatalogEventsEnabled = true; env.publicCatalogWriterEnabled = false; });
afterEach(cleanup);
describe("owner publication lifecycle", () => {
  it("reader rollback keeps accepted operations locked and manually recoverable", async () => {
    env.publicCatalogEventsEnabled = false; env.publicCatalogWriterEnabled = true;
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: receipt(input.operationId) }));
    const { result } = renderHook(() => useCatalogPublication("owner"));
    await act(async () => { try { await result.current.run({ method: "PATCH", route: "/restaurants/me", body: {} }); } catch { /* Publication remains pending. */ } });
    expect(runCatalogMutation).toHaveBeenCalledOnce(); expect(result.current.blocked).toBe(true);
    const key = result.current.operationId!; vi.mocked(getCatalogOperation).mockResolvedValue(receipt(key, "ready"));
    await act(async () => { await result.current.check(); }); expect(getCatalogOperation).toHaveBeenCalledWith(key, expect.any(AbortSignal)); expect(result.current.blocked).toBe(false);
  });
  it("locks conflicting actions after acceptance, with no automatic status/retry", async () => {
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: receipt(input.operationId) }));
    const { result } = renderHook(() => useCatalogPublication("owner"));
    let error: unknown;
    await act(async () => { try { await result.current.run({ method: "PATCH", route: "/restaurants/me", body: { name: "Bistrô" } }); } catch (value) { error = value; } });
    expect(isCatalogPublicationDeferred(error)).toBe(true); expect(result.current.blocked).toBe(true); expect(result.current.receipt?.phase).toBe("committed");
    await act(async () => { await expect(result.current.run({ method: "PATCH", route: "/restaurants/me", body: {} })).rejects.toThrow(); });
    expect(runCatalogMutation).toHaveBeenCalledOnce(); expect(getCatalogOperation).not.toHaveBeenCalled(); expect(retryCatalogOperation).not.toHaveBeenCalled();
  });
  it("manual status/retry uses the original key and reloads only on ready", async () => {
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: receipt(input.operationId) }));
    const published = vi.fn(); const { result } = renderHook(() => useCatalogPublication("owner", published));
    await act(async () => { try { await result.current.run({ method: "PATCH", route: "/restaurants/me", body: {} }); } catch { /* Accepted operation intentionally remains pending. */ } });
    const key = vi.mocked(runCatalogMutation).mock.calls[0]![0].operationId;
    vi.mocked(getCatalogOperation).mockResolvedValue(receipt(key)); vi.mocked(retryCatalogOperation).mockResolvedValue(receipt(key, "ready"));
    await act(async () => { await result.current.check(); }); expect(getCatalogOperation).toHaveBeenCalledWith(key, expect.any(AbortSignal)); expect(published).not.toHaveBeenCalled();
    await act(async () => { await result.current.retry(); }); expect(retryCatalogOperation).toHaveBeenCalledWith(key, expect.any(AbortSignal)); expect(published).toHaveBeenCalledOnce(); expect(result.current.blocked).toBe(false);
  });
  it("ready without a private result uses one explicit resource reload, not another mutation", async () => {
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: receipt(input.operationId, "ready") }));
    const reload = vi.fn().mockResolvedValue({ id: "saved" }); const { result } = renderHook(() => useCatalogPublication("owner"));
    let saved: unknown; await act(async () => { saved = await result.current.run({ method: "PATCH", route: "/restaurants/me", body: {} }, reload); });
    expect(saved).toEqual({ id: "saved" }); expect(reload).toHaveBeenCalledOnce(); expect(runCatalogMutation).toHaveBeenCalledOnce();
  });
  it("sequential actions get different keys, including the image's second PATCH", async () => {
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: receipt(input.operationId, "ready"), result: { id: "saved" } }));
    const { result } = renderHook(() => useCatalogPublication("owner"));
    await act(async () => { await result.current.run({ method: "POST", route: "/restaurants/me/menu-items", body: {} });
      await result.current.run({ method: "PATCH", route: "/restaurants/me/menu-items/33333333-3333-4333-8333-333333333333", body: { imageUrl: "https://assets.test/file.webp" } }); });
    const keys = vi.mocked(runCatalogMutation).mock.calls.map(([value]) => value.operationId); expect(keys[0]).not.toBe(keys[1]);
  });
  it("logout cancels transport, ignores late results and never runs a continuation or retry", async () => {
    let finish!: (value: unknown) => void; vi.mocked(runCatalogMutation).mockImplementation(input => new Promise(resolve => { finish = () => resolve({ receipt: receipt(input.operationId, "ready"), result: {} }); }));
    const reload = vi.fn(); const { result, rerender } = renderHook(({ owner }) => useCatalogPublication(owner), { initialProps: { owner: "owner" as string | undefined } });
    let pending: Promise<unknown>; act(() => { pending = result.current.run({ method: "PATCH", route: "/restaurants/me", body: {} }, reload).catch(error => error); });
    const signal = vi.mocked(runCatalogMutation).mock.calls[0]![0].signal; rerender({ owner: undefined }); expect(signal?.aborted).toBe(true);
    await act(async () => { finish({}); await pending; }); expect(result.current.receipt).toBeNull(); expect(reload).not.toHaveBeenCalled();
    await act(async () => { await result.current.retry(); }); expect(retryCatalogOperation).not.toHaveBeenCalled();
  });
  it("ambiguous transport errors stay locked for manual verification, never auto-replay", async () => {
    vi.mocked(runCatalogMutation).mockRejectedValue(new Error("Synthetic lost response")); const { result } = renderHook(() => useCatalogPublication("owner"));
    await act(async () => { await expect(result.current.run({ method: "PATCH", route: "/restaurants/me", body: {} })).rejects.toThrow(); });
    expect(result.current.uncertain).toBe(true); expect(result.current.blocked).toBe(true); expect(runCatalogMutation).toHaveBeenCalledOnce();
    expect(getCatalogOperation).not.toHaveBeenCalled();
  });
  it("a definitive blocked, uncommitted, non-retryable command does not lock all future editing", async () => {
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: { ...receipt(input.operationId, "blocked"), committed: false, version: null, retryable: false } }));
    const { result } = renderHook(() => useCatalogPublication("owner"));
    await act(async () => { try { await result.current.run({ method: "PATCH", route: "/restaurants/me", body: {} }); } catch { /* Definitive failure, no domain commit. */ } });
    expect(result.current.receipt?.phase).toBe("blocked"); expect(result.current.blocked).toBe(false);
  });
  it("a resource reload failure after ready never claims that publication failed", async () => {
    vi.mocked(runCatalogMutation).mockImplementation(async input => ({ receipt: receipt(input.operationId) }));
    const { result } = renderHook(() => useCatalogPublication("owner", async () => { throw new Error("Synthetic reload failure"); }));
    await act(async () => { try { await result.current.run({ method: "PATCH", route: "/restaurants/me", body: {} }); } catch { /* Pending publication. */ } });
    const key = vi.mocked(runCatalogMutation).mock.calls[0]![0].operationId; vi.mocked(getCatalogOperation).mockResolvedValue(receipt(key, "ready"));
    await act(async () => { await result.current.check(); });
    expect(result.current.receipt?.phase).toBe("ready"); expect(result.current.error).toBe("Publicada, mas não foi possível recarregar os dados.");
  });
});
