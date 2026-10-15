import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const auth = vi.hoisted(() => ({ useSession: vi.fn(), signOut: vi.fn(), refetch: vi.fn() }));
vi.mock("@/lib/env", () => ({ ENV: { realtimeEnabled: true, vaptApiBaseUrl: "https://api.synthetic.test" } }));
vi.mock("@/lib/auth-client", () => ({ authClient: { useSession: auth.useSession, signOut: auth.signOut } }));
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { clearOwnerRealtimeScopes, subscribeRealtime } from "@/lib/realtime/client";
const rest = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
class Socket {
  static all: Socket[] = [];
  readyState = 0; onmessage: ((value: { data: string }) => void) | null = null;
  onopen = null; onclose = null; onerror = null;
  constructor() { Socket.all.push(this); }
  close() { this.readyState = 3; }
  send() {}
}
const response = () => {
  const expiresAt = Date.now() + 30_000;
  return new Response(JSON.stringify({ ticket: `rt1.${"a".repeat(43)}.${expiresAt}.${"b".repeat(43)}`, restaurantId: rest, expiresAt }));
};
const session = (id: string) => ({ data: { user: { id, email: "synthetic@example.test", name: "Synthetic" },
  session: { id: `session-${id}`, userId: id, expiresAt: new Date(Date.now() + 60_000) } },
  isPending: false, isRefetching: false, refetch: auth.refetch });
const wrapper = ({ children }: { children: ReactNode }) => createElement(AuthProvider, null, children);
let stops: Array<() => void>;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); Socket.all = []; stops = [];
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  vi.stubGlobal("WebSocket", Socket); vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => response()));
  auth.useSession.mockReturnValue(session("owner-1")); auth.signOut.mockResolvedValue({ error: null }); auth.refetch.mockResolvedValue(undefined);
});
afterEach(() => { for (const stop of stops) stop(); clearOwnerRealtimeScopes(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test("logout closes real owner scope but does not revoke the independent public order consumer", async () => {
  const view = renderHook(() => useAuth(), { wrapper });
  stops.push(subscribeRealtime({ mode: "owner", userId: "owner-1", restaurantId: rest }, vi.fn(), vi.fn()));
  stops.push(subscribeRealtime({ mode: "order", orderId, token: "synthetic-token" }, vi.fn(), vi.fn()));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); }); expect(Socket.all).toHaveLength(2);
  await act(async () => { await view.result.current.signOut(); });
  expect(Socket.all[0].readyState).toBe(3); expect(Socket.all[1].readyState).toBe(0);
  view.unmount();
});

test("session identity switch invalidates an owner ticket still pending in the real client", async () => {
  let resolve!: (value: Response) => void;
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>(r => { resolve = r; })));
  const view = renderHook(() => useAuth(), { wrapper });
  stops.push(subscribeRealtime({ mode: "owner", userId: "owner-1", restaurantId: rest }, vi.fn(), vi.fn()));
  auth.useSession.mockReturnValue(session("owner-2")); view.rerender();
  await act(async () => { resolve(response()); await vi.advanceTimersByTimeAsync(0); });
  expect(Socket.all).toHaveLength(0); view.unmount();
});

test("new session for the same user re-admits retained consumers with a fresh ticket", async () => {
  const view = renderHook(() => useAuth(), { wrapper });
  stops.push(subscribeRealtime({ mode: "owner", userId: "owner-1", restaurantId: rest }, vi.fn(), vi.fn()));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const replacement = session("owner-1"); replacement.data.session.id = "replacement-session";
  auth.useSession.mockReturnValue(replacement); view.rerender();
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(Socket.all[0].readyState).toBe(3); expect(Socket.all).toHaveLength(2);
  view.unmount();
});
