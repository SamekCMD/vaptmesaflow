import type { CatalogState } from "@/lib/catalog/contracts";
export const catalogRestaurantId = "11111111-1111-4111-8111-111111111111";
export function catalogState(version = "11", slug = "bistro", restaurantId = catalogRestaurantId): CatalogState {
  return { version, catalog: { restaurant: { id: restaurantId, name: "Bistrô", slug, whatsapp: null, address: null, phone: null, hours: null, description: null,
    primaryColor: "#123456", secondaryColor: "#654321", fontFamily: "modern", logoUrl: null, totalTables: 1, maxTables: 1,
    paymentMode: "open_tab", maxPendingOrders: 3, localEnabled: true, deliveryEnabled: true, updatedAt: "2026-10-16T00:00:00Z" }, items: [] } };
}
export const catalogFrame = (type: "ready" | "catalog_changed", version: string) => JSON.stringify({ protocol: "vapt.catalog.v1", type, version, canonicalSlug: "bistro" });
