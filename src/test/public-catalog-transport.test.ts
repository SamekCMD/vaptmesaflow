import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublicCatalogTransport } from "@/lib/catalog/client";
import { createPublicCatalogRegistry } from "@/lib/catalog/controller";
import { catalogRestaurantId, catalogState } from "./public-catalog-fixture";

afterEach(() => { vi.unstubAllGlobals(); });
describe("public catalog network boundary", () => {
  it("follows a canonical slug signal after the original URL is tombstoned, without changing tenant", async () => {
    const sockets: Array<{ onmessage: ((event: { data: string }) => void) | null }> = [];
    vi.stubGlobal("WebSocket", class {
      onopen = null; onclose = null; onerror = null; onmessage = null;
      constructor() { sockets.push(this); } close() {} send() {}
    });
    let originalReads = 0;
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/old-bistro/catalog-state")) return ++originalReads === 1
        ? new Response(JSON.stringify(catalogState("11", "old-bistro"))) : new Response("{}", { status: 404 });
      if (url.endsWith("/new-bistro/catalog-state")) return new Response(JSON.stringify(catalogState("12", "new-bistro")));
      throw new Error("Unexpected public route");
    });
    vi.stubGlobal("fetch", fetch);
    const registry = createPublicCatalogRegistry({ active: () => true, watch: () => () => {}, transport: createPublicCatalogTransport });
    const handle = registry.acquire({ apiBaseUrl: "https://api.test", slug: "old-bistro" });
    try {
      await vi.waitFor(() => expect(sockets).toHaveLength(1));
      sockets[0]!.onmessage?.({ data: JSON.stringify({ protocol: "vapt.catalog.v1", type: "ready", version: "11", canonicalSlug: "old-bistro" }) });
      sockets[0]!.onmessage?.({ data: JSON.stringify({ protocol: "vapt.catalog.v1", type: "catalog_changed", version: "12", canonicalSlug: "new-bistro" }) });
      await vi.waitFor(() => expect(handle.getSnapshot().state?.version).toBe("12"));
      expect(handle.getSnapshot().state?.catalog.restaurant).toMatchObject({ id: catalogRestaurantId, slug: "new-bistro" });
      expect(handle.getSnapshot().status).toBe("ready");
      expect(originalReads).toBe(1);
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally { handle.release(); }
  });
  it("reads the requested API base with omitted credentials, an abortable GET and no private ticket", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(catalogState()), { status: 200 })); vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const transport = createPublicCatalogTransport({ apiBaseUrl: "https://separate-api.test/prefix", slug: "bistro" });
    expect(await transport.read(controller.signal)).toEqual(catalogState());
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0]!;
    expect(url).toBe("https://separate-api.test/prefix/public/restaurants/bistro/catalog-state");
    expect(options).toMatchObject({ method: "GET", credentials: "omit", headers: {} });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.headers).not.toHaveProperty("Authorization");
  });
  it("uses only the public catalog protocol and websocket path, including a pre-versioned API base", () => {
    const opened: unknown[][] = []; vi.stubGlobal("WebSocket", class { constructor(url: string | URL, protocols: string[]) { opened.push([String(url), protocols]); } });
    createPublicCatalogTransport({ apiBaseUrl: "https://api.test", slug: "bistro" }).open(catalogRestaurantId);
    createPublicCatalogTransport({ apiBaseUrl: "http://127.0.0.1:1234/v1", slug: "bistro" }).open(catalogRestaurantId);
    expect(opened).toEqual([[`wss://api.test/v1/catalog/restaurants/${catalogRestaurantId}/socket`, ["vapt.catalog.v1"]],
      [`ws://127.0.0.1:1234/v1/catalog/restaurants/${catalogRestaurantId}/socket`, ["vapt.catalog.v1"]]]);
  });
  it("rejects unsafe bases, invalid slug/UUID and private/cross-tenant payloads before applying data", async () => {
    for (const apiBaseUrl of ["http://remote.test", "https://user:password@api.test", "https://api.test/?secret=x", "https://api.test/#fragment"]) {
      expect(() => createPublicCatalogTransport({ apiBaseUrl, slug: "bistro" })).toThrow();
    }
    expect(() => createPublicCatalogTransport({ apiBaseUrl: "https://api.test", slug: "../other" })).toThrow();
    const transport = createPublicCatalogTransport({ apiBaseUrl: "https://api.test", slug: "bistro" });
    expect(() => transport.open("not-a-uuid")).toThrow();
    const state = catalogState();
    for (const bad of [{ ...state, version: "01" }, { ...state, owner: "private" }, { ...state, catalog: { ...state.catalog, restaurant: { ...state.catalog.restaurant, cnpj: "private" } } },
      { ...state, catalog: { ...state.catalog, items: [{ restaurantId: "22222222-2222-4222-8222-222222222222" }] } }]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(bad), { status: 200 })));
      await expect(transport.read(new AbortController().signal)).rejects.toThrow();
    }
  });
  it("abort rejects even when a transport ignores cancellation", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const controller = new AbortController(); const request = createPublicCatalogTransport({ apiBaseUrl: "https://api.test", slug: "bistro" }).read(controller.signal);
    controller.abort(); await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});
