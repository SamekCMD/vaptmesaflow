import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicCatalogRegistry, type CatalogSocket } from "@/lib/catalog/controller";
import { catalogFrame, catalogState } from "./public-catalog-fixture";
import type { CatalogState } from "@/lib/catalog/contracts";

class Socket implements CatalogSocket {
  onopen: (() => void) | null = null; onclose: (() => void) | null = null; onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  sent: string[] = []; closed = false;
  send(value: string) { this.sent.push(value); }
  close() { this.closed = true; }
  frame(value: unknown) { this.onmessage?.({ data: value }); }
}
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  let active = true; let changed = () => {}; let version = "11";
  const sockets: Socket[] = []; const reads: { signal: AbortSignal; value: ReturnType<typeof deferred<CatalogState>> }[] = [];
  const registry = createPublicCatalogRegistry({
    active: () => active, watch: listener => { changed = listener; return () => { changed = () => {}; }; },
    transport: () => ({ read: (signal: AbortSignal) => { const value = deferred<CatalogState>(); reads.push({ signal, value }); return value.promise; },
      open: () => { const socket = new Socket(); sockets.push(socket); return socket; } }),
  });
  const handles: ReturnType<typeof registry.acquire>[] = [];
  const acquire = (slug = "bistro") => { const handle = registry.acquire({ apiBaseUrl: "https://api.test", slug }); handles.push(handle); return handle; };
  const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
  const bootstrap = async () => { const handle = acquire(); reads.at(-1)!.value.resolve(catalogState(version)); await settle(); sockets.at(-1)!.frame(catalogFrame("ready", version)); return handle; };
  return { acquire, bootstrap, sockets, reads, settle, environment: (value: boolean) => { active = value; changed(); },
    version: (value: string) => { version = value; }, dispose: () => { for (const handle of handles) handle.release(); } };
}
const fixtures: ReturnType<typeof fixture>[] = [];
const make = () => { const value = fixture(); fixtures.push(value); return value; };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-16T12:00:00Z")); });
afterEach(() => { fixtures.splice(0).forEach(value => value.dispose()); vi.useRealTimers(); });

describe("event-driven public catalog controller", () => {
  it("tenStableTabsZeroRefreshes: an hour of healthy heartbeats never refreshes HTTP", async () => {
    const tabs = Array.from({ length: 10 }, make);
    for (const tab of tabs) { await tab.bootstrap(); const socket = tab.sockets[0]!;
      const send = socket.send.bind(socket); socket.send = value => { send(value); socket.frame("vapt.catalog.v1:pong"); }; }
    await vi.advanceTimersByTimeAsync(3_600_000);
    for (const tab of tabs) { expect(tab.reads).toHaveLength(1); expect(tab.sockets).toHaveLength(1); expect(tab.sockets[0]!.sent).toHaveLength(60); }
  });
  it("oneReadPerNewVersion and same-page consumers share HTTP/socket, including versions above2**53", async () => {
    const f = make(); f.version("9007199254740992"); const a = await f.bootstrap(); const b = f.acquire();
    expect(f.reads).toHaveLength(1); expect(f.sockets).toHaveLength(1);
    for (const version of ["9007199254740993", "9007199254740993", "11"]) f.sockets[0]!.frame(catalogFrame("catalog_changed", version));
    expect(f.reads).toHaveLength(2); f.reads[1]!.value.resolve(catalogState("9007199254740993")); await f.settle();
    expect(a.getSnapshot().state?.version).toBe("9007199254740993"); expect(b.getSnapshot()).toBe(a.getSnapshot());
    a.release(); expect(f.sockets[0]!.closed).toBe(false); b.release(); expect(f.sockets[0]!.closed).toBe(true);
  });
  it("coalescesInflightBurst into one additional read, never an overlapping request", async () => {
    const f = make(); const handle = await f.bootstrap();
    for (const version of ["12", "13", "14"]) f.sockets[0]!.frame(catalogFrame("catalog_changed", version));
    expect(f.reads).toHaveLength(2); f.reads[1]!.value.resolve(catalogState("13")); await f.settle();
    expect(f.reads).toHaveLength(3); f.reads[2]!.value.resolve(catalogState("14")); await f.settle();
    expect(handle.getSnapshot().state?.version).toBe("14"); expect(f.reads).toHaveLength(3);
  });
  it("readyRepairsInitialRace with exactly one fresh read", async () => {
    const f = make(); const handle = f.acquire(); f.reads[0]!.value.resolve(catalogState("11")); await f.settle();
    f.sockets[0]!.frame(catalogFrame("ready", "12")); expect(f.reads).toHaveLength(2);
    f.reads[1]!.value.resolve(catalogState("12")); await f.settle(); expect(handle.getSnapshot().status).toBe("ready");
  });
  it("fresh ready retries a failed read of the same desired version without polling", async () => {
    const f = make(); const handle = await f.bootstrap(); f.sockets[0]!.frame(catalogFrame("catalog_changed", "12"));
    f.reads[1]!.value.reject({ status: 503 }); await f.settle(); expect(handle.getSnapshot().state?.version).toBe("11");
    f.sockets[0]!.onclose?.(); await vi.advanceTimersByTimeAsync(1000);
    expect(f.reads).toHaveLength(2); f.sockets[1]!.frame(catalogFrame("ready", "12")); expect(f.reads).toHaveLength(3);
    f.reads[2]!.value.resolve(catalogState("12")); await f.settle(); expect(handle.getSnapshot().status).toBe("ready");
  });
  it("a persistently stale projection cannot create an HTTP retry loop", async () => {
    const f = make(); const handle = await f.bootstrap(); f.sockets[0]!.frame(catalogFrame("catalog_changed", "12"));
    f.reads[1]!.value.resolve(catalogState("11")); await f.settle(); f.reads[2]!.value.resolve(catalogState("11")); await f.settle();
    expect(f.reads).toHaveLength(3); expect(handle.getSnapshot().status).toBe("unavailable");
    expect(handle.getSnapshot().state?.version).toBe("11");
    f.sockets[0]!.frame(catalogFrame("catalog_changed", "10"));
    expect(handle.getSnapshot().status).toBe("unavailable"); expect(f.reads).toHaveLength(3);
  });
  it("hidden/offline aborts and clears timers; resume reads once and ignores late aborted data", async () => {
    const f = make(); const handle = await f.bootstrap(); f.sockets[0]!.frame(catalogFrame("catalog_changed", "12"));
    f.environment(false); expect(f.reads[1]!.signal.aborted).toBe(true); expect(f.sockets[0]!.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(3_600_000); expect(f.reads).toHaveLength(2); expect(f.sockets).toHaveLength(1);
    expect(handle.getSnapshot().status).toBe("offline"); f.environment(true); expect(f.reads).toHaveLength(3);
    f.reads[1]!.value.resolve(catalogState("99")); f.reads[2]!.value.resolve(catalogState("12")); await f.settle();
    expect(handle.getSnapshot().state?.version).toBe("12"); expect(f.sockets).toHaveLength(2);
  });
  it("oldSlugResponseDiscarded after release; a reused slug cannot replace another tenant's catalog", async () => {
    const f = make(); const old = f.acquire("old-bistro"); old.release(); const current = f.acquire();
    expect(f.reads[0]!.signal.aborted).toBe(true);
    f.reads[0]!.value.resolve(catalogState("99", "old-bistro")); f.reads[1]!.value.resolve(catalogState("11")); await f.settle();
    expect(current.getSnapshot().state?.catalog.restaurant.slug).toBe("bistro");
    f.sockets[0]!.frame(catalogFrame("ready", "12")); f.reads[2]!.value.resolve(catalogState("12", "bistro", "22222222-2222-4222-8222-222222222222")); await f.settle();
    expect(current.getSnapshot().state?.catalog.restaurant.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(current.getSnapshot().status).toBe("unavailable");
  });
  it.each(["early-close", "hung", "pong-before-ready"])("%s has only five bounded reconnects; TCP open never resets budget", async failure => {
    const f = make(); const handle = f.acquire(); f.reads[0]!.value.resolve(catalogState()); await f.settle();
    for (let attempt = 0; attempt < 6; attempt++) {
      const socket = f.sockets.at(-1)!; socket.onopen?.();
      if (failure === "early-close") socket.onclose?.();
      else if (failure === "pong-before-ready") socket.frame("vapt.catalog.v1:pong");
      else await vi.advanceTimersByTimeAsync(10_000);
      if (attempt < 5) await vi.advanceTimersByTimeAsync(1000 * 2 ** attempt);
    }
    expect(f.sockets).toHaveLength(6); expect(handle.getSnapshot().status).toBe("unavailable");
    await vi.advanceTimersByTimeAsync(3_600_000); expect(f.sockets).toHaveLength(6); expect(f.reads).toHaveLength(1);
    handle.refresh(); expect(f.reads).toHaveLength(2);
  });
  it("invalid protocol/binary/oversize closes instead of requesting data", async () => {
    const f = make(); await f.bootstrap(); f.sockets[0]!.frame(new ArrayBuffer(4)); expect(f.sockets[0]!.closed).toBe(true); expect(f.reads).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000); f.sockets[1]!.frame(catalogFrame("ready", "11"));
    f.sockets[1]!.frame("é".repeat(257)); expect(f.sockets[1]!.closed).toBe(true); expect(f.reads).toHaveLength(1);
  });
  it("late background timer does not send a burst of delayed heartbeats", async () => {
    const f = make(); await f.bootstrap(); vi.setSystemTime(Date.now() + 3_600_000);
    await vi.advanceTimersByTimeAsync(60_000); expect(f.sockets[0]!.sent).toHaveLength(0); expect(f.sockets[0]!.closed).toBe(true); expect(f.reads).toHaveLength(1);
  });
  it("a prior socket's missing pong cannot authorize an unsolicited pong after reconnect", async () => {
    const f = make(); await f.bootstrap(); await vi.advanceTimersByTimeAsync(60_000);
    f.sockets[0]!.onclose?.(); await vi.advanceTimersByTimeAsync(1000);
    f.sockets[1]!.frame(catalogFrame("ready", "11")); f.sockets[1]!.frame("vapt.catalog.v1:pong");
    expect(f.sockets[1]!.closed).toBe(true);
  });
  it.each([404, 503])("HTTP%d has no periodic retry; manual retry recovers", async status => {
    const f = make(); const handle = f.acquire(); f.reads[0]!.value.reject({ status, code: status === 404 ? "not_found" : "catalog_unavailable" }); await f.settle();
    expect(handle.getSnapshot().status).toBe("unavailable"); await vi.advanceTimersByTimeAsync(60_000); expect(f.reads).toHaveLength(1);
    handle.refresh(); f.reads[1]!.value.resolve(catalogState()); await f.settle(); f.sockets[0]!.frame(catalogFrame("ready", "11")); expect(handle.getSnapshot().status).toBe("ready");
  });
});
