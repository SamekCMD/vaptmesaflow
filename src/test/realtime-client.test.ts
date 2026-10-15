import { afterEach, beforeEach, expect, test, vi } from "vitest";

const rest = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const eventId = "33333333-3333-4333-8333-333333333333";
const owner = { mode: "owner", userId: "owner-1", restaurantId: rest } as const;
const guest = { mode: "order", orderId, token: "private-order-token" } as const;
const ticket = (expiresAt = Date.now() + 30_000) => `rt1.${"a".repeat(43)}.${expiresAt}.${"b".repeat(43)}`;
const now = Date.parse("2026-10-05T12:00:00Z");
let online = true; let hidden = false;
let stops: Array<() => void> = [];

// External network boundary only. Admission/parser/registry are real.
class Socket {
  static all: Socket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;
  sent: string[] = [];
  constructor(readonly url: string, readonly protocols: string[]) { Socket.all.push(this); }
  ready(expiry = Date.now() + 300_000) { this.readyState = 1; this.onopen?.(); this.message({ version: 1, type: "ready", leaseExpiresAt: expiry }); }
  message(value: unknown) { this.onmessage?.({ data: typeof value === "string" ? value : JSON.stringify(value) }); }
  send(value: string) { this.sent.push(value); }
  close(code = 1000) { if (this.readyState === 3) return; this.readyState = 3; this.onclose?.({ code }); }
}
let fetchSpy: ReturnType<typeof vi.fn>;
const response = () => { const expiresAt = Date.now() + 30_000; return new Response(JSON.stringify({ ticket: ticket(expiresAt), restaurantId: rest, expiresAt }), { status: 200 }); };
async function client() {
  const actual = await import("../lib/realtime/client");
  return { ...actual, subscribeRealtime: (...args: Parameters<typeof actual.subscribeRealtime>) => {
    const stop = actual.subscribeRealtime(...args); stops.push(stop); return stop;
  } };
}
const flush = async () => { await vi.advanceTimersByTimeAsync(0); };
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("VITE_REALTIME_ENABLED", "true");
  vi.stubEnv("VITE_VAPT_API_BASE_URL", "https://api.test.example.com");
  online = true; hidden = false; Socket.all = []; stops = [];
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  vi.stubGlobal("WebSocket", Socket);
  fetchSpy = vi.fn().mockImplementation(async () => response()); vi.stubGlobal("fetch", fetchSpy);
});
afterEach(async () => {
  for (const stop of stops) stop();
  const module = await import("../lib/realtime/client");
  module.clearOwnerRealtimeScopes();
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

test("same scope shares one socket with refcounts; owner and guest never share admission", async () => {
  const c = await client(); const one = vi.fn(); const two = vi.fn();
  const stop1 = c.subscribeRealtime(owner, one, vi.fn());
  const stop2 = c.subscribeRealtime({ ...owner }, two, vi.fn());
  await flush(); expect(Socket.all).toHaveLength(1);
  Socket.all[0].ready(); expect(one).toHaveBeenCalledWith("connected"); expect(two).toHaveBeenCalledWith("connected");
  const stopGuest = c.subscribeRealtime(guest, vi.fn(), vi.fn()); await flush(); expect(Socket.all).toHaveLength(2);
  expect(fetchSpy.mock.calls[0][1].credentials).toBe("include");
  expect(fetchSpy.mock.calls[1][1].credentials).toBe("omit");
  expect(fetchSpy.mock.calls[1][1].headers).toEqual({ "Content-Type": "application/json", "X-Vapt-Order-Token": guest.token });
  expect(JSON.parse(fetchSpy.mock.calls[1][1].body)).toEqual({ mode: "order", orderId });
  stop1(); expect(Socket.all[0].readyState).toBe(1); stop2(); expect(Socket.all[0].readyState).toBe(3);
  stopGuest(); expect(vi.getTimerCount()).toBe(0);
});

test.each([
  ["https://api.vapt.app.br", "https://api.vapt.app.br/v1/realtime/tickets", `wss://api.vapt.app.br/v1/realtime/restaurants/${rest}/socket`],
  ["http://localhost:8789/browser/v1", "http://localhost:8789/browser/v1/realtime/tickets", `ws://localhost:8789/browser/v1/realtime/restaurants/${rest}/socket`],
  ["http://localhost:8789/browser", "http://localhost:8789/browser/v1/realtime/tickets", `ws://localhost:8789/browser/v1/realtime/restaurants/${rest}/socket`],
])("admission and socket use the server v1 routes exactly once for API base %s", async (base, admissionUrl, socketEndpoint) => {
  vi.stubEnv("VITE_VAPT_API_BASE_URL", base);
  // The production server registers /v1/realtime, not /realtime. Enforce
  // that external boundary so a permissive fake cannot mask route drift.
  fetchSpy.mockImplementation(async (url, options) => {
    if (url !== admissionUrl || options.method !== "POST") return new Response("{}", { status: 404 });
    return response();
  });
  const stop = (await client()).subscribeRealtime(owner, vi.fn(), vi.fn()); await flush();
  expect(Socket.all).toHaveLength(1);
  expect(Socket.all[0].url).toBe(socketEndpoint);
  expect(fetchSpy).toHaveBeenCalledWith(admissionUrl, expect.objectContaining({
    method: "POST", credentials: "include", body: JSON.stringify({ mode: "owner", restaurantId: rest }),
  }));
  stop();
});

test("ticket is sent only in subprotocols and socket URL contains no credential", async () => {
  const stop = (await client()).subscribeRealtime(guest, vi.fn(), vi.fn()); await flush();
  expect(Socket.all[0].url).toBe(`wss://api.test.example.com/v1/realtime/restaurants/${rest}/socket`);
  expect(Socket.all[0].protocols).toEqual(["vapt.realtime.v1", `vapt.ticket.${ticket()}`]);
  expect(Socket.all[0].url).not.toContain(ticket()); expect(Socket.all[0].url).not.toContain(guest.token);
  expect(Socket.all[0].url).not.toContain("?"); stop();
});

test("signed ingress ticket is forwarded only as opaque subprotocol authority", async () => {
  const expiresAt = Date.now() + 30_000;
  const signed = `rt1.${"a".repeat(43)}.${expiresAt}.${"b".repeat(43)}`;
  fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ticket: signed, restaurantId: rest, expiresAt }), { status: 200 }));
  const stop = (await client()).subscribeRealtime(guest, vi.fn(), vi.fn()); await flush();
  expect(Socket.all).toHaveLength(1);
  expect(Socket.all[0].protocols).toEqual(["vapt.realtime.v1", `vapt.ticket.${signed}`]);
  expect(Socket.all[0].url).not.toContain(signed); stop();
});

test("unsigned ticket does not open a socket", async () => {
  fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ticket: "a".repeat(43), restaurantId: rest, expiresAt: Date.now() + 30_000 }), { status: 200 }));
  const stop = (await client()).subscribeRealtime(guest, vi.fn(), vi.fn()); await flush();
  expect(Socket.all).toHaveLength(0); stop();
});
test("small server clock skew does not reject a signed ticket while excessive expiry still fails", async () => {
  const c = await client();
  for (const [aheadMs, admitted] of [[5000, true], [5001, false]] as const) {
    const expiresAt = Date.now() + 30_000 + aheadMs;
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ticket:ticket(expiresAt),restaurantId:rest,expiresAt}),{status:200}));
    const before=Socket.all.length, stop=c.subscribeRealtime(guest,vi.fn(),vi.fn());await flush();
    expect(Socket.all.length-before).toBe(admitted?1:0);stop();
  }
});
test("server clock skew in ready keeps renewal bounded and never extends the client lease timer", async () => {
  const signal=vi.fn(),stop=(await client()).subscribeRealtime(guest,signal,vi.fn());await flush();
  Socket.all[0].ready(Date.now()+305_000);
  expect(signal).toHaveBeenCalledWith("connected");
  await vi.advanceTimersByTimeAsync(294_999);expect(fetchSpy).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);expect(fetchSpy).toHaveBeenCalledTimes(2);
  expect(Socket.all[0].readyState).toBe(3);expect(Socket.all).toHaveLength(2);stop();
});

test("stalled ticket admission times out and retries; discarded admission is aborted", async () => {
  let pendingSignal!: AbortSignal;
  fetchSpy.mockImplementationOnce((_url, options) => new Promise<Response>((_resolve, reject) => {
    pendingSignal=options.signal;
    options.signal?.addEventListener("abort",()=>reject(options.signal.reason),{once:true});
  }));
  const stop=(await client()).subscribeRealtime(owner,vi.fn(),vi.fn());
  await vi.advanceTimersByTimeAsync(10_000); expect(pendingSignal?.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(1000); expect(fetchSpy).toHaveBeenCalledTimes(2); expect(Socket.all).toHaveLength(1); stop();
  fetchSpy.mockImplementation((_url, options) => new Promise<Response>((_resolve,reject)=>{
    pendingSignal=options.signal; options.signal?.addEventListener("abort",()=>reject(options.signal.reason),{once:true});
  }));
  const stopPending=(await client()).subscribeRealtime(guest,vi.fn(),vi.fn()); await flush();
  stopPending(); expect(pendingSignal?.aborted).toBe(true); await flush();
  expect(Socket.all).toHaveLength(1); expect(vi.getTimerCount()).toBe(0);
});

test("socket endpoint preserves the configured API base path", async () => {
  vi.stubEnv("VITE_VAPT_API_BASE_URL", "http://localhost:8789/browser/v1");
  const stop = (await client()).subscribeRealtime(owner, vi.fn(), vi.fn()); await flush();
  expect(Socket.all[0].url).toBe(`ws://localhost:8789/browser/v1/realtime/restaurants/${rest}/socket`); stop();
});

test("lease renews five seconds early through a fresh ticket without overlapping sockets", async () => {
  const stop = (await client()).subscribeRealtime(owner, vi.fn(), vi.fn()); await flush(); Socket.all[0].ready();
  window.dispatchEvent(new Event("online"));
  await vi.advanceTimersByTimeAsync(294_999); expect(fetchSpy).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1); expect(fetchSpy).toHaveBeenCalledTimes(2);
  expect(Socket.all[0].readyState).toBe(3); expect(Socket.all).toHaveLength(2); stop();
});

test("expired or excessive lease and invalid frames fall back; public scope rejects private and neighboring data", async () => {
  const c = await client();
  for (const frame of [
    { version: 1, type: "ready", leaseExpiresAt: Date.now() + 5_000 },
    { version: 1, type: "ready", leaseExpiresAt: Date.now() + 305_001 },
    { version: 2, topic: "orders", eventId, entityId: orderId, reason: "updated", sequence: 1 },
    { version: 1, topic: "payments", eventId, entityId: orderId, reason: "updated", sequence: 1 },
    { version: 1, topic: "orders", eventId, entityId: rest, reason: "updated", sequence: 1 },
    "x".repeat(4097),
  ]) {
    const signal = vi.fn(); const state = vi.fn(); const stop = c.subscribeRealtime(guest, signal, state); await flush();
    const socket = Socket.all.at(-1)!; socket.readyState = 1;
    if (!(typeof frame === "object" && "type" in frame)) socket.ready();
    signal.mockClear(); socket.message(frame);
    expect(socket.readyState).toBe(3); expect(state).toHaveBeenLastCalledWith("fallback");
    expect(signal).not.toHaveBeenCalled(); expect(socket.sent).toEqual([]); stop();
  }
});

test("only valid advancing envelopes are delivered and acknowledged", async () => {
  const signal = vi.fn(); const stop = (await client()).subscribeRealtime(guest, signal, vi.fn()); await flush();
  const socket = Socket.all[0]; socket.ready(); signal.mockClear();
  const envelope = { version: 1, eventId, sequence: 1, topic: "orders", entityId: orderId, reason: "updated" };
  socket.message(envelope); socket.message(envelope);
  expect(signal).toHaveBeenCalledTimes(1); expect(signal).toHaveBeenCalledWith(envelope);
  expect(socket.sent).toEqual([JSON.stringify({ version: 1, type: "ack", sequence: 1 })]);
  socket.message({ ...envelope, sequence: 2, token: "unexpected" });
  expect(socket.readyState).toBe(3); expect(socket.sent).toHaveLength(1); stop();
});

test("retry uses bounded backoff while public unauthorized admission never loops", async () => {
  const c = await client(); const stop = c.subscribeRealtime(owner, vi.fn(), vi.fn()); await flush();
  for (let attempt = 0; attempt < 7; attempt++) {
    const count = fetchSpy.mock.calls.length; const started = Date.now(); Socket.all.at(-1)!.close(1013);
    await vi.advanceTimersByTimeAsync(999); expect(fetchSpy).toHaveBeenCalledTimes(count);
    await vi.advanceTimersToNextTimerAsync(); expect(fetchSpy).toHaveBeenCalledTimes(count + 1);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1000); expect(Date.now() - started).toBeLessThanOrEqual(30_000);
  }
  stop(); fetchSpy.mockResolvedValue(new Response("{}", { status: 401 }));
  const state = vi.fn(); const stopGuest = c.subscribeRealtime(guest, vi.fn(), state); await flush();
  expect(state).toHaveBeenLastCalledWith("unauthorized"); const count = fetchSpy.mock.calls.length;
  await vi.advanceTimersByTimeAsync(300_000); expect(fetchSpy).toHaveBeenCalledTimes(count); stopGuest();
});

test("hidden/offline suspend sockets and resume admission; clearing owner scopes cancels a pending identity", async () => {
  const c = await client(); const stop = c.subscribeRealtime(owner, vi.fn(), vi.fn()); await flush(); Socket.all[0].ready();
  hidden = true; document.dispatchEvent(new Event("visibilitychange"));
  expect(Socket.all[0].readyState).toBe(3); await vi.advanceTimersByTimeAsync(60_000); expect(fetchSpy).toHaveBeenCalledTimes(1);
  hidden = false; online = false; document.dispatchEvent(new Event("visibilitychange")); await flush();
  expect(fetchSpy).toHaveBeenCalledTimes(1); online = true; window.dispatchEvent(new Event("online")); await flush();
  expect(fetchSpy).toHaveBeenCalledTimes(2); stop();
  let resolve!: (response: Response) => void;
  fetchSpy.mockImplementation(() => new Promise<Response>(r => { resolve = r; }));
  const stopPending = c.subscribeRealtime(owner, vi.fn(), vi.fn()); await flush();
  c.clearOwnerRealtimeScopes(); resolve(response()); await flush(); expect(Socket.all).toHaveLength(2);
  stopPending(); expect(vi.getTimerCount()).toBe(0);
});

test("disabled flag or non-local plain HTTP never opens a socket", async () => {
  vi.stubEnv("VITE_REALTIME_ENABLED", "false"); const c = await client();
  const stop = c.subscribeRealtime(owner, vi.fn(), vi.fn()); await flush(); expect(fetchSpy).not.toHaveBeenCalled(); stop();
  vi.resetModules(); vi.stubEnv("VITE_REALTIME_ENABLED", "true"); vi.stubEnv("VITE_VAPT_API_BASE_URL", "http://remote.synthetic.test");
  const remoteStop = (await client()).subscribeRealtime(owner, vi.fn(), vi.fn()); await flush();
  expect(Socket.all).toHaveLength(0); expect(fetchSpy).not.toHaveBeenCalled(); remoteStop();
});
