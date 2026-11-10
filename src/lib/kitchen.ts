import {restaurantRoute} from "@/lib/restaurants";
import type { KitchenOrderDto } from "@/lib/business-api.types";
import { vaptApiRequest } from "@/lib/vapt-api-client";

export type KitchenOrderTargetStatus = "preparing" | "ready" | "delivered";

export function listKitchenOrders(restaurantId:string): Promise<KitchenOrderDto[]> {
  return vaptApiRequest<KitchenOrderDto[]>({
    method: "GET",
    route: `${restaurantRoute(restaurantId)}/kitchen/orders`,
  });
}

export function updateKitchenOrderStatus(
  restaurantId:string,
  orderId: string,
  status: KitchenOrderTargetStatus,
): Promise<KitchenOrderDto> {
  return vaptApiRequest<KitchenOrderDto>({
    method: "PATCH",
    route: `${restaurantRoute(restaurantId)}/kitchen/orders/${encodeURIComponent(orderId)}/status`,
    body: { status },
  });
}
