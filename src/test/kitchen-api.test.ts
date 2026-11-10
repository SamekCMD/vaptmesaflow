import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KitchenOrderDto } from "@/lib/business-api.types";
import { listKitchenOrders, updateKitchenOrderStatus } from "@/lib/kitchen";
import { vaptApiRequest } from "@/lib/vapt-api-client";

vi.mock("@/lib/vapt-api-client", () => ({ vaptApiRequest: vi.fn() }));

const restaurantId="22222222-2222-4222-8222-222222222222";
const mockedRequest = vi.mocked(vaptApiRequest);
const order = { id: "order-1" } as KitchenOrderDto;

describe("kitchen API client", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("uses the authenticated active queue route", async () => {
    mockedRequest.mockResolvedValue([order]);
    await listKitchenOrders(restaurantId);
    expect(mockedRequest).toHaveBeenCalledWith({
      method: "GET",
      route: "/restaurants/22222222-2222-4222-8222-222222222222/kitchen/orders",
    });
  });

  it("encodes the order id and sends only the target status", async () => {
    mockedRequest.mockResolvedValue(order);
    await updateKitchenOrderStatus(restaurantId,"order/with slash", "ready");
    expect(mockedRequest).toHaveBeenCalledWith({
      method: "PATCH",
      route: "/restaurants/22222222-2222-4222-8222-222222222222/kitchen/orders/order%2Fwith%20slash/status",
      body: { status: "ready" },
    });
  });
});
