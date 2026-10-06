import { ENV } from "@/lib/env";
import { VaptApiClientError, vaptApiRequest } from "@/lib/vapt-api-client";
import { parseRealtimeEnvelope, parseRealtimeReady, sameRealtimeScope, uuidPattern,
  type RealtimeAck, type RealtimeEnvelope, type RealtimeScope } from "./contracts";
export type { RealtimeScope } from "./contracts";
export type RealtimeState = "connected" | "fallback" | "unauthorized";
type Consumer = { signal(value: "connected" | RealtimeEnvelope): void; state(value: RealtimeState): void };
type Entry = {
  scope: RealtimeScope; consumers: Set<Consumer>; generation: number; state: RealtimeState; disposed: boolean;
  blocked: boolean; connecting: boolean; attempts: number; socket?: WebSocket; timer?: ReturnType<typeof setTimeout>;
};
// No token-derived/loggable keys. Equality is checked in memory only.
const entries = new Set<Entry>();
const active = () => navigator.onLine !== false && !document.hidden;
const safely = (call: () => void) => { try { call(); } catch { /* isolate consumers */ } };
function state(entry: Entry, value: RealtimeState) {
  if (entry.state === value) return;
  entry.state = value;
  for (const consumer of entry.consumers) safely(() => consumer.state(value));
}
function signal(entry: Entry, value: "connected" | RealtimeEnvelope) {
  for (const consumer of entry.consumers) safely(() => consumer.signal(value));
}
function stopTransport(entry: Entry) {
  entry.generation++; entry.connecting = false;
  clearTimeout(entry.timer); entry.timer = undefined;
  const socket = entry.socket; entry.socket = undefined;
  if (socket) { socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null; safely(() => socket.close(1000)); }
}
function fallback(entry: Entry, unauthorized = false) {
  stopTransport(entry); entry.blocked = unauthorized;
  state(entry, unauthorized ? "unauthorized" : "fallback");
  if (entry.disposed || unauthorized || !active()) return;
  const base = Math.min(30_000, 1000 * 2 ** Math.min(entry.attempts++, 5));
  const delay = Math.max(1000, Math.min(30_000, Math.round(base * (0.5 + Math.random() * 0.5))));
  entry.timer = setTimeout(() => { entry.timer = undefined; void connect(entry); }, delay);
}
function socketUrl(restaurantId: string): string {
  const url = new URL(ENV.vaptApiBaseUrl);
  if (url.username || url.password || url.search || url.hash) throw new Error("Invalid API URL");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol === "https:") url.protocol = "wss:";
  else if (url.protocol === "http:" && local) url.protocol = "ws:";
  else throw new Error("Unsafe API URL");
  url.pathname = `${url.pathname.replace(/\/$/, "")}/realtime/restaurants/${restaurantId}`;
  return url.toString();
}
async function connect(entry: Entry) {
  if (entry.disposed || entry.blocked || entry.connecting || entry.socket || !active()) return;
  const generation = ++entry.generation;
  entry.connecting = true;
  const current = () => !entry.disposed && entry.generation === generation && active();
  try {
    socketUrl(entry.scope.mode === "owner" ? entry.scope.restaurantId : "pending");
    const scope = entry.scope;
    const admission = await vaptApiRequest<{ ticket: string; restaurantId: string; expiresAt: number }>({
      method: "POST", route: "realtime/tickets", requireAuth: scope.mode === "owner",
      body: scope.mode === "owner" ? { mode: "owner", restaurantId: scope.restaurantId } : { mode: "order", orderId: scope.orderId },
      headers: scope.mode === "order" ? { "X-Vapt-Order-Token": scope.token } : {},
    });
    if (!current()) return;
    if (!admission || Object.keys(admission).sort().join(",") !== "expiresAt,restaurantId,ticket"
      || typeof admission.ticket !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(admission.ticket)
      || !uuidPattern.test(admission.restaurantId) || !Number.isSafeInteger(admission.expiresAt)
      || admission.expiresAt <= Date.now() || admission.expiresAt > Date.now() + 30_000
      || (scope.mode === "owner" && admission.restaurantId !== scope.restaurantId)) throw new Error("Invalid ticket");
    const socket = new WebSocket(socketUrl(admission.restaurantId), ["vapt.realtime.v1", `vapt.ticket.${admission.ticket}`]);
    entry.socket = socket; entry.connecting = false;
    let ready = false; let sequence = 0;
    entry.timer = setTimeout(() => { if (current()) fallback(entry); }, 10_000);
    socket.onerror = () => { if (current()) fallback(entry); };
    socket.onclose = event => { if (current()) fallback(entry, event.code === 1008); };
    socket.onmessage = event => {
      if (!current()) return;
      try {
        if (typeof event.data !== "string" || new TextEncoder().encode(event.data).byteLength > 4096) throw new Error("Invalid frame");
        const value: unknown = JSON.parse(event.data);
        if (!ready) {
          const control = parseRealtimeReady(value);
          if (!control || control.leaseExpiresAt <= Date.now() + 5000 || control.leaseExpiresAt > Date.now() + 300_000) throw new Error("Invalid lease");
          ready = true; entry.attempts = 0; clearTimeout(entry.timer);
          entry.timer = setTimeout(() => {
            if (!current()) return;
            stopTransport(entry); state(entry, "fallback"); void connect(entry);
          }, control.leaseExpiresAt - Date.now() - 5000);
          state(entry, "connected"); signal(entry, "connected"); return;
        }
        const envelope = parseRealtimeEnvelope(value);
        if (!envelope || (scope.mode === "order" && (envelope.topic !== "orders" || envelope.entityId !== scope.orderId))) throw new Error("Invalid envelope");
        if (envelope.sequence <= sequence) return;
        sequence = envelope.sequence;
        const ack: RealtimeAck = { version: 1, type: "ack", sequence };
        socket.send(JSON.stringify(ack)); signal(entry, envelope);
      } catch { fallback(entry); }
    };
  } catch (error) {
    if (current()) fallback(entry, error instanceof VaptApiClientError && [401, 403].includes(error.status));
  }
}
function environmentChanged() {
  for (const entry of entries) {
    if (!active()) { stopTransport(entry); if (!entry.blocked) state(entry, "fallback"); }
    else if (!entry.blocked && !entry.socket && !entry.connecting) {
      clearTimeout(entry.timer); entry.timer = undefined; void connect(entry);
    }
  }
}
function listeners(add: boolean) {
  if (add) {
    window.addEventListener("online", environmentChanged); window.addEventListener("offline", environmentChanged);
    document.addEventListener("visibilitychange", environmentChanged);
  } else {
    window.removeEventListener("online", environmentChanged); window.removeEventListener("offline", environmentChanged);
    document.removeEventListener("visibilitychange", environmentChanged);
  }
}
function dispose(entry: Entry) {
  entry.disposed = true; stopTransport(entry); entries.delete(entry); entry.consumers.clear();
  if (!entries.size) listeners(false);
}
export function subscribeRealtime(scope: RealtimeScope, onSignal: Consumer["signal"], onState: Consumer["state"]): () => void {
  if (!ENV.realtimeEnabled) { safely(() => onState("fallback")); return () => {}; }
  try { socketUrl(scope.mode === "owner" ? scope.restaurantId : "pending"); }
  catch { safely(() => onState("fallback")); return () => {}; }
  let entry = [...entries].find(candidate => sameRealtimeScope(candidate.scope, scope));
  if (!entry) {
    if (!entries.size) listeners(true);
    entry = { scope: { ...scope }, consumers: new Set(), generation: 0, state: "fallback", disposed: false, blocked: false, connecting: false, attempts: 0 };
    entries.add(entry);
  }
  const consumer = { signal: onSignal, state: onState }; entry.consumers.add(consumer);
  safely(() => onState(entry.state));
  if (entry.state === "connected") safely(() => onSignal("connected"));
  void connect(entry);
  return () => { entry.consumers.delete(consumer); if (!entry.consumers.size && !entry.disposed) dispose(entry); };
}
export function clearOwnerRealtimeScopes(): void {
  for (const entry of entries) if (entry.scope.mode === "owner") fallback(entry, true);
}
/** AuthProvider calls this only after a new authenticated session identity. */
export function resumeOwnerRealtimeScopes(userId: string): void {
  for (const entry of entries) if (entry.scope.mode === "owner" && entry.scope.userId === userId && entry.blocked) {
    entry.blocked = false; entry.attempts = 0; state(entry, "fallback"); void connect(entry);
  }
}
