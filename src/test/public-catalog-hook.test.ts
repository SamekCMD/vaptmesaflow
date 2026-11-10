import { createElement, StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePublicCatalog } from "@/hooks/use-public-catalog";
import { catalogFrame, catalogState } from "./public-catalog-fixture";

const environment = vi.hoisted(() => ({ vaptApiBaseUrl: "https://api.test", publicCatalogEventsEnabled: true }));
vi.mock("@/lib/env", () => ({ ENV: environment }));
class Socket {
  static all: Socket[] = [];
  onopen: (() => void) | null = null; onclose: (() => void) | null = null; onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;
  constructor() { Socket.all.push(this); }
  send() {} close() { this.closed = true; }
  frame(data: string) { this.onmessage?.({ data }); }
}
let requests: { url: string; signal: AbortSignal; resolve(response: Response): void }[];
beforeEach(() => {
  vi.useFakeTimers(); environment.publicCatalogEventsEnabled = true; Socket.all = []; requests = [];
  vi.spyOn(document, "hidden", "get").mockReturnValue(false); vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("fetch", vi.fn((url: string, options: { signal: AbortSignal }) => new Promise<Response>(resolve => requests.push({ url, signal: options.signal, resolve }))));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
const resolve = async (index: number, slug = "bistro") => { await act(async () => { requests[index]!.resolve(new Response(JSON.stringify(catalogState("11", slug)))); }); };
describe("public catalog hook resource lifecycle", () => {
  it("StrictMode aborts the discarded request and leaves one live resource, then no orphan on unmount", async () => {
    const { result, unmount } = renderHook(() => usePublicCatalog("bistro"), { wrapper: ({ children }) => createElement(StrictMode, null, children) });
    expect(requests).toHaveLength(2); expect(requests[0]!.signal.aborted).toBe(true);
    await resolve(0); expect(Socket.all).toHaveLength(0); await resolve(1); expect(Socket.all).toHaveLength(1);
    act(() => Socket.all[0]!.frame(catalogFrame("ready", "11"))); expect(result.current.status).toBe("ready");
    unmount(); expect(Socket.all[0]!.closed).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it("components using the same catalog share a read and socket", async () => {
    const { result, unmount } = renderHook(() => [usePublicCatalog("bistro"), usePublicCatalog("bistro")]);
    expect(requests).toHaveLength(1); await resolve(0); expect(Socket.all).toHaveLength(1);
    act(() => Socket.all[0]!.frame(catalogFrame("ready", "11")));
    expect(result.current[0]!.state).toBe(result.current[1]!.state); unmount(); expect(Socket.all[0]!.closed).toBe(true);
  });
  it("slug change immediately hides the previous catalog and releases its socket", async () => {
    const { result, rerender } = renderHook(({ slug }) => usePublicCatalog(slug), { initialProps: { slug: "bistro" } });
    await resolve(0); act(() => Socket.all[0]!.frame(catalogFrame("ready", "11")));
    rerender({ slug: "new-bistro" }); expect(result.current.state).toBeNull(); expect(Socket.all[0]!.closed).toBe(true);
    await resolve(1, "new-bistro"); expect(result.current.state?.catalog.restaurant.slug).toBe("new-bistro");
  });
  it("disabled-by-default rollout does not touch HTTP or WebSocket", () => {
    environment.publicCatalogEventsEnabled = false; const { result } = renderHook(() => usePublicCatalog("bistro"));
    expect(requests).toHaveLength(0); expect(Socket.all).toHaveLength(0); expect(result.current.errorCode).toBe("catalog_events_disabled");
  });
});
