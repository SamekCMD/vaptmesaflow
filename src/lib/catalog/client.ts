import { z } from "zod";
import { ENV } from "@/lib/env";
import { vaptApiRequest } from "@/lib/vapt-api-client";
import { compareVersion, type CatalogState } from "./contracts";
import { createPublicCatalogRegistry, type CatalogResourceOptions, type CatalogTransport, type CatalogSocket, type CatalogResource, type PublicCatalogView } from "./controller";

const slugSchema = z.string().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const nullableText = z.string().nullable();
const publicStateSchema = z.object({
  version: z.string().refine(value => { try { compareVersion(value, "1"); return true; } catch { return false; } }),
  catalog: z.object({ restaurant: z.object({
    id: z.string().uuid(), name: z.string(), slug: slugSchema, whatsapp: nullableText, address: nullableText, phone: nullableText,
    hours: nullableText, description: nullableText, primaryColor: z.string(), secondaryColor: z.string(), fontFamily: z.string(), logoUrl: nullableText,
    totalTables: z.number().int(), maxTables: z.number().int(), paymentMode: z.enum(["open_tab", "prepaid"]), maxPendingOrders: z.number().int(),
    localEnabled: z.boolean(), deliveryEnabled: z.boolean(), updatedAt: z.string(),
  }).strict(), items: z.array(z.object({
    id: z.string().uuid(), restaurantId: z.string().uuid(), name: z.string(), price: z.string(), description: nullableText, category: z.string(), available: z.boolean(),
    imageUrl: nullableText, availableFrom: nullableText, availableUntil: nullableText, badge: nullableText, isChefSuggestion: z.boolean(), prepTimeMinutes: z.number().int().nullable(),
    createdAt: z.string(), updatedAt: z.string(), variations: z.array(z.object({ id: z.string().uuid(), name: z.string(), options: z.array(z.string()), required: z.boolean() }).strict()),
  }).strict()) }).strict(),
}).strict();

export function createPublicCatalogTransport(options: CatalogResourceOptions): CatalogTransport {
  const base = new URL(options.apiBaseUrl);
  if (base.username || base.password || base.search || base.hash || (base.protocol !== "https:" &&
    !(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)))) throw new Error("Invalid catalog API base");
  const slug = slugSchema.parse(options.slug); const apiBaseUrl = base.toString().replace(/\/+$/, "");
  return {
    async read(signal) {
      const result = await vaptApiRequest<unknown>({ apiBaseUrl, method: "GET", route: `/public/restaurants/${slug}/catalog-state`, requireAuth: false, signal });
      // Required keys are enforced at runtime. The existing non-strict TS
      // configuration otherwise infers Zod object properties as optional.
      const state = publicStateSchema.parse(result) as CatalogState;
      if (state.catalog.items.some(item => item.restaurantId !== state.catalog.restaurant.id)) throw new Error("Invalid catalog identity");
      return state;
    },
    open(restaurantId) {
      const id = z.string().uuid().parse(restaurantId).toLowerCase();
      const url = new URL(apiBaseUrl); url.protocol = base.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = `${url.pathname.replace(/\/$/, "")}/${url.pathname.replace(/\/$/, "").endsWith("/v1") ? "catalog" : "v1/catalog"}/restaurants/${id}/socket`;
      return new WebSocket(url, ["vapt.catalog.v1"]) as unknown as CatalogSocket;
    },
  };
}
const registry = createPublicCatalogRegistry({
  environment: import.meta.env.MODE,
  active: () => navigator.onLine !== false && !document.hidden,
  watch(listener) {
    window.addEventListener("focus", listener); window.addEventListener("online", listener); window.addEventListener("offline", listener); document.addEventListener("visibilitychange", listener);
    return () => { window.removeEventListener("focus", listener); window.removeEventListener("online", listener); window.removeEventListener("offline", listener); document.removeEventListener("visibilitychange", listener); };
  },
  transport: createPublicCatalogTransport,
});
export const disabledCatalogView: PublicCatalogView = { state: null, status: "unavailable", errorCode: "catalog_events_disabled" };
export function acquirePublicCatalog(options: CatalogResourceOptions): CatalogResource {
  if (!ENV.publicCatalogEventsEnabled) return { subscribe: () => () => {}, getSnapshot: () => disabledCatalogView, refresh() {}, release() {} };
  return registry.acquire(options);
}
