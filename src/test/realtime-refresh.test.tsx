import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { RealtimeEnvelope } from "../lib/realtime/contracts";

const port = vi.hoisted(() => ({ subscribe: vi.fn(), stop: vi.fn() }));
vi.mock("@/lib/realtime/client", () => ({ subscribeRealtime: port.subscribe }));
let onSignal: (value: "connected" | RealtimeEnvelope) => void;
let onState: (value: "connected" | "fallback" | "unauthorized") => void;
let hidden = false; let online = true;
const scope = [{ mode: "owner", userId: "owner-1", restaurantId: "11111111-1111-4111-8111-111111111111" }] as const;
const envelope: RealtimeEnvelope = { version: 1, eventId: "33333333-3333-4333-8333-333333333333", sequence: 1,
  entityId: "22222222-2222-4222-8222-222222222222", reason: "updated", topic: "orders" };
async function hook() {
  return (await import("../hooks/use-realtime-refresh")).useRealtimeRefresh;
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); hidden = false; online = true;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  port.subscribe.mockImplementation((_scope, signal, state) => { onSignal = signal; onState = state; state("fallback"); return port.stop; });
});
afterEach(() => { vi.useRealTimers(); });
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

test("connected snapshot and concurrent invalidations yield one dirty refetch, never concurrent reads", async () => {
  const useRefresh = await hook(); let release!: () => void;
  const refresh = vi.fn().mockImplementationOnce(() => new Promise<void>(r => { release = r; })).mockResolvedValue(undefined);
  const view = renderHook(() => useRefresh({ scopes: scope, topics: ["orders"], enabled: true, refresh, fallbackMs: 4_000 }));
  await advance(0); expect(refresh).toHaveBeenCalledTimes(1);
  act(() => { onState("connected"); onSignal("connected"); onSignal(envelope); onSignal(envelope); });
  await advance(250); expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => { release(); }); expect(refresh).toHaveBeenCalledTimes(2);
  view.unmount(); expect(port.stop).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});

test("healthy connection uses only thirty-second safety reads; fallback restores the original single interval", async () => {
  const useRefresh = await hook(); const refresh = vi.fn().mockResolvedValue(undefined);
  const view = renderHook(() => useRefresh({ scopes: scope, topics: ["orders"], enabled: true, refresh, fallbackMs: 4_000 }));
  await advance(0); act(() => { onState("connected"); onSignal("connected"); }); await advance(250);
  const count = refresh.mock.calls.length; await advance(29_749); expect(refresh).toHaveBeenCalledTimes(count);
  await advance(1); expect(refresh).toHaveBeenCalledTimes(count + 1);
  act(() => onState("fallback")); await advance(3_999); expect(refresh).toHaveBeenCalledTimes(count + 1);
  await advance(1); expect(refresh).toHaveBeenCalledTimes(count + 2);
  expect(vi.getTimerCount()).toBe(1); view.unmount(); expect(vi.getTimerCount()).toBe(0);
});

test("bursts debounce, irrelevant topics are ignored and failed reads recover on the next poll", async () => {
  const useRefresh = await hook(); const refresh = vi.fn().mockResolvedValue(undefined);
  const view = renderHook(() => useRefresh({ scopes: scope, topics: ["orders"], enabled: true, refresh, fallbackMs: 4_000 }));
  await advance(0); act(() => { onState("connected"); onSignal("connected"); }); await advance(250); refresh.mockClear();
  act(() => { onSignal({ ...envelope, topic: "payments" }); }); await advance(250); expect(refresh).not.toHaveBeenCalled();
  refresh.mockRejectedValueOnce(new Error("synthetic read failure"));
  act(() => { onSignal(envelope); onSignal(envelope); }); await advance(249); expect(refresh).not.toHaveBeenCalled();
  await advance(1); expect(refresh).toHaveBeenCalledTimes(1); await advance(30_000); expect(refresh).toHaveBeenCalledTimes(2);
  view.unmount();
});

test("hidden/offline suspend refresh; return resyncs and inline equal scopes do not recreate consumers", async () => {
  const useRefresh = await hook(); const refresh = vi.fn().mockResolvedValue(undefined);
  const view = renderHook(() => useRefresh({ scopes: [{ ...scope[0] }], topics: ["orders"], enabled: true, refresh, fallbackMs: 4_000 }));
  await advance(0); view.rerender(); expect(port.subscribe).toHaveBeenCalledTimes(1);
  act(() => onSignal(envelope));
  hidden = true; act(() => document.dispatchEvent(new Event("visibilitychange"))); await advance(60_000);
  expect(refresh).toHaveBeenCalledTimes(1);
  hidden = false; online = false; act(() => document.dispatchEvent(new Event("visibilitychange"))); await advance(0);
  expect(refresh).toHaveBeenCalledTimes(1);
  online = true; act(() => window.dispatchEvent(new Event("online"))); await advance(0); expect(refresh).toHaveBeenCalledTimes(2);
  view.unmount();
});

test("disabled realtime preserves fallback polling without admission and scope changes clean up consumers", async () => {
  const useRefresh = await hook(); const refresh = vi.fn().mockResolvedValue(undefined);
  const view = renderHook(({ enabled }) => useRefresh({ scopes: scope, topics: ["orders"], enabled, refresh, fallbackMs: 5_000 }), { initialProps: { enabled: false } });
  await advance(0); expect(port.subscribe).not.toHaveBeenCalled(); await advance(5_000); expect(refresh).toHaveBeenCalledTimes(2);
  view.rerender({ enabled: true }); expect(port.subscribe).toHaveBeenCalledTimes(1);
  view.rerender({ enabled: false }); expect(port.stop).toHaveBeenCalledTimes(1); view.unmount(); expect(vi.getTimerCount()).toBe(0);
});

test("several newly connected scopes coalesce the authoritative snapshot into one read", async () => {
  const useRefresh = await hook(); const refresh = vi.fn().mockResolvedValue(undefined);
  const consumers: Array<{ signal: typeof onSignal; state: typeof onState }> = [];
  port.subscribe.mockImplementation((_scope, signal, state) => { consumers.push({ signal, state }); return port.stop; });
  const view = renderHook(() => useRefresh({ scopes: [scope[0], { mode: "order", orderId: envelope.entityId, token: "synthetic-token" }],
    topics: ["orders"], enabled: true, refresh, fallbackMs: 4_000 }));
  await advance(0); expect(refresh).toHaveBeenCalledTimes(1);
  act(() => { for (const consumer of consumers) { consumer.state("connected"); consumer.signal("connected"); } });
  await advance(249); expect(refresh).toHaveBeenCalledTimes(1);
  await advance(1); expect(refresh).toHaveBeenCalledTimes(2); view.unmount();
});

test("inactive resource has no admission, initial read or polling timer", async () => {
  const useRefresh = await hook(); const refresh = vi.fn().mockResolvedValue(undefined);
  const view = renderHook(({ active }) => useRefresh({ scopes: scope, topics: ["orders"], enabled: true, refresh, fallbackMs: 4_000, active }), { initialProps: { active: false } });
  await advance(60_000); expect(refresh).not.toHaveBeenCalled(); expect(port.subscribe).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  view.rerender({ active: true }); await advance(0); expect(refresh).toHaveBeenCalledTimes(1);
  view.rerender({ active: false }); expect(vi.getTimerCount()).toBe(0); view.unmount();
});

test("owner scope lookup does not duplicate an already-started initial fallback read", async () => {
  const useRefresh = await hook(); const refresh = vi.fn().mockResolvedValue(undefined);
  const view = renderHook(({ scopes }) => useRefresh({ scopes, topics: ["orders"], enabled: true, refresh, fallbackMs: 5_000 }),
    { initialProps: { scopes: [] as readonly typeof scope[number][] } });
  await advance(0); expect(refresh).toHaveBeenCalledTimes(1);
  view.rerender({ scopes: scope }); await advance(0); expect(refresh).toHaveBeenCalledTimes(1);
  act(() => { onState("connected"); onSignal("connected"); }); await advance(250); expect(refresh).toHaveBeenCalledTimes(2);
  view.unmount();
});
