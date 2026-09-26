import type { KitchenOrderDto } from "@/lib/business-api.types";
import { vaptApiRequest } from "@/lib/vapt-api-client";

export type KitchenOrderTargetStatus = "preparing" | "ready" | "delivered";

export function listKitchenOrders(): Promise<KitchenOrderDto[]> {
  return vaptApiRequest<KitchenOrderDto[]>({
    method: "GET",
    route: "/restaurants/me/kitchen/orders",
  });
}

export function updateKitchenOrderStatus(
  orderId: string,
  status: KitchenOrderTargetStatus,
): Promise<KitchenOrderDto> {
  return vaptApiRequest<KitchenOrderDto>({
    method: "PATCH",
    route: `/restaurants/me/kitchen/orders/${encodeURIComponent(orderId)}/status`,
    body: { status },
  });
}
