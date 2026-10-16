import { compareVersion, parseCatalogSignal, type CatalogState } from "./contracts";
export type PublicCatalogView = { state: CatalogState | null; status: "loading" | "ready" | "reconnecting" | "offline" | "unavailable"; errorCode: string | null };
export type CatalogSocket = { onopen: (() => void) | null; onclose: (() => void) | null; onerror: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null; send(value: string): void; close(code?: number): void };
export type CatalogResource = { subscribe(listener: () => void): () => void; getSnapshot(): PublicCatalogView; refresh(): void; release(): void };
export type CatalogResourceOptions = { apiBaseUrl: string; slug: string };
export type CatalogTransport = { read(signal: AbortSignal): Promise<CatalogState>; open(restaurantId: string): CatalogSocket };
type Ports = { environment?: string; active(): boolean; watch(listener: () => void): () => void; transport(options: CatalogResourceOptions): CatalogTransport };
type Entry = {
  refs: number; view: PublicCatalogView; listeners: Set<() => void>; disposed: boolean; generation: number;
  transport: CatalogTransport; stopWatch: () => void; request?: AbortController;
  desired?: string; rereads: number; attempts: number; socketEpoch: number; socket?: CatalogSocket; ready: boolean;
  handshake?: ReturnType<typeof setTimeout>; heartbeat?: ReturnType<typeof setTimeout>; retry?: ReturnType<typeof setTimeout>;
};
const safely = (call: () => void) => { try { call(); } catch { /* One observer cannot interrupt another. */ } };
export function createPublicCatalogRegistry(ports: Ports): { acquire(options: CatalogResourceOptions): CatalogResource } {
  const entries = new Map<string, Entry>();
  function update(entry: Entry, patch: Partial<PublicCatalogView>) {
    entry.view = { ...entry.view, ...patch };
    for (const listener of entry.listeners) safely(listener);
  }
  function stopSocket(entry: Entry) {
    entry.socketEpoch++; entry.ready = false;
    pendingPongs.delete(entry);
    clearTimeout(entry.handshake); entry.handshake = undefined;
    clearTimeout(entry.heartbeat); entry.heartbeat = undefined;
    const socket = entry.socket; entry.socket = undefined;
    if (socket) { socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null; safely(() => socket.close(1000)); }
  }
  function stop(entry: Entry) {
    entry.generation++; entry.request?.abort(); entry.request = undefined;
    clearTimeout(entry.retry); entry.retry = undefined; stopSocket(entry);
  }
  function failedSocket(entry: Entry) {
    stopSocket(entry);
    if (entry.disposed || !ports.active()) return;
    if (entry.attempts >= 5) { update(entry, { status: "unavailable", errorCode: "catalog_connection_unavailable" }); return; }
    update(entry, { status: "reconnecting", errorCode: "catalog_connection_unavailable" });
    const delay = Math.min(60_000, 1000 * 2 ** entry.attempts++);
    entry.retry = setTimeout(() => { entry.retry = undefined; open(entry); }, delay);
  }
  function heartbeat(entry: Entry, socket: CatalogSocket, current: () => boolean) {
    const due = Date.now() + 60_000;
    entry.heartbeat = setTimeout(() => {
      entry.heartbeat = undefined;
      if (!current()) return;
      // A suspended tab must not catch up by sending stale heartbeat bursts.
      if (Date.now() > due + 10_000) { failedSocket(entry); return; }
      const deadline = Date.now() + 10_000;
      entry.handshake = setTimeout(() => { if (current()) failedSocket(entry); }, 10_000);
      pendingPongs.set(entry, deadline);
      try { socket.send("vapt.catalog.v1:ping"); } catch { failedSocket(entry); }
    }, 60_000);
  }
  // Transport-only state, discarded on close; no cookie/session lease.
  const pendingPongs = new WeakMap<Entry, number>();
  function open(entry: Entry) {
    if (entry.disposed || !ports.active() || entry.socket || entry.retry || !entry.view.state) return;
    const epoch = ++entry.socketEpoch;
    const current = () => !entry.disposed && entry.socketEpoch === epoch && ports.active();
    const deadline = Date.now() + 10_000;
    try {
      const socket = entry.transport.open(entry.view.state.catalog.restaurant.id); entry.socket = socket;
      entry.handshake = setTimeout(() => { if (current()) failedSocket(entry); }, 10_000);
      socket.onopen = () => {}; // TCP open is not protocol readiness and never resets retries.
      socket.onclose = socket.onerror = () => { if (current()) failedSocket(entry); };
      socket.onmessage = event => {
        if (!current()) return;
        if (event.data === "vapt.catalog.v1:pong") {
          const expected = pendingPongs.get(entry);
          if (!entry.ready || expected === undefined || Date.now() > expected) { failedSocket(entry); return; }
          pendingPongs.delete(entry); clearTimeout(entry.handshake); entry.handshake = undefined;
          heartbeat(entry, socket, current); return;
        }
        const value = typeof event.data === "string" ? parseCatalogSignal(event.data) : null;
        if (!value || (!entry.ready && (value.type !== "ready" || Date.now() > deadline)) || (entry.ready && value.type === "ready")) {
          failedSocket(entry); return;
        }
        if (!entry.ready) {
          entry.ready = true; entry.attempts = 0;
          entry.rereads = 1;
          clearTimeout(entry.handshake); entry.handshake = undefined; heartbeat(entry, socket, current);
        }
        const advanced = !entry.desired || compareVersion(value.version, entry.desired) > 0;
        if (advanced) { entry.desired = value.version; entry.rereads = 1; }
        if (entry.view.state && compareVersion(value.version, entry.view.state.version) > 0) {
          // A fresh ready also repairs a prior failed read of an already-known
          // target. Duplicate change notifications cannot start a retry loop.
          if (advanced || value.type === "ready") void read(entry);
        } else if (!entry.request && (!entry.desired || compareVersion(entry.view.state!.version, entry.desired) >= 0)) update(entry, { status: "ready", errorCode: null });
      };
    } catch { failedSocket(entry); }
  }
  async function read(entry: Entry) {
    if (entry.disposed || !ports.active() || entry.request) return;
    const request = new AbortController(); entry.request = request;
    const generation = entry.generation;
    const current = () => !entry.disposed && entry.generation === generation && !request.signal.aborted && ports.active();
    let again = false;
    try {
      const state = await entry.transport.read(request.signal);
      if (!current()) return;
      compareVersion(state.version, "1");
      const previous = entry.view.state;
      if (previous && state.catalog.restaurant.id !== previous.catalog.restaurant.id) throw new Error("Catalog identity changed");
      const next = !previous || compareVersion(state.version, previous.version) >= 0 ? state : previous;
      const behind = entry.desired && compareVersion(next.version, entry.desired) < 0;
      update(entry, { state: next, status: entry.ready && !behind ? "ready" : "reconnecting", errorCode: null });
      if (behind) {
        if (entry.rereads > 0) { entry.rereads--; again = true; }
        else update(entry, { status: "unavailable", errorCode: "catalog_version_unavailable" });
      }
      open(entry);
    } catch (error) {
      if (current()) update(entry, { status: "unavailable", errorCode: typeof error === "object" && error !== null && "status" in error && error.status === 404 ? "not_found" : "catalog_unavailable" });
    } finally {
      if (entry.request === request) entry.request = undefined;
      if (again && current()) void read(entry);
    }
  }
  function resume(entry: Entry) {
    if (entry.disposed) return;
    if (!ports.active()) { stop(entry); pendingPongs.delete(entry); update(entry, { status: "offline", errorCode: null }); return; }
    entry.attempts = 0; entry.rereads = 1;
    clearTimeout(entry.retry); entry.retry = undefined;
    update(entry, { status: entry.view.state ? "reconnecting" : "loading", errorCode: null });
    void read(entry);
  }
  return { acquire(options) {
    const key = JSON.stringify([ports.environment ?? "", options.apiBaseUrl.replace(/\/+$/, ""), options.slug]);
    let entry = entries.get(key);
    if (!entry) {
      entry = { refs: 0, view: { state: null, status: "loading", errorCode: null }, listeners: new Set(), disposed: false, generation: 0,
        transport: ports.transport(options), stopWatch: () => {}, rereads: 1, attempts: 0, socketEpoch: 0, ready: false };
      entries.set(key, entry); const value = entry;
      entry.stopWatch = ports.watch(() => resume(value)); resume(entry);
    }
    const value = entry; value.refs++; let released = false; const listeners = new Set<() => void>();
    return {
      getSnapshot: () => value.view,
      subscribe(listener) {
        if (released) return () => {};
        value.listeners.add(listener); listeners.add(listener);
        return () => { value.listeners.delete(listener); listeners.delete(listener); };
      },
      refresh() { if (!released) resume(value); },
      release() {
        if (released) return; released = true;
        for (const listener of listeners) value.listeners.delete(listener);
        listeners.clear();
        if (--value.refs === 0) { value.disposed = true; stop(value); value.stopWatch(); entries.delete(key); }
      },
    };
  } };
}
