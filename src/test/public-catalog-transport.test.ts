import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublicCatalogTransport } from "@/lib/catalog/client";
import { catalogRestaurantId, catalogState } from "./public-catalog-fixture";

afterEach(() => { vi.unstubAllGlobals(); });
describe("public catalog network boundary", () => {
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
