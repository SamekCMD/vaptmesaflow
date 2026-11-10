import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RestaurantDto } from "@/lib/business-api.types";
import {
  createOnboarding,
  fetchOwnedRestaurant,
  updateOwnedRestaurant,
} from "@/lib/restaurants";
import { VaptApiClientError, vaptApiRequest } from "@/lib/vapt-api-client";

vi.mock("@/lib/vapt-api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vapt-api-client")>();
  return { ...actual, vaptApiRequest: vi.fn() };
});

const mockedRequest = vi.mocked(vaptApiRequest);
const restaurant = { id: "restaurant-1", name: "Vapt Burger" } as RestaurantDto;

describe("owned restaurant API client", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("loads the restaurant for the authenticated cookie without owner or select arguments", async () => {
    mockedRequest.mockResolvedValue(restaurant);

    await expect(fetchOwnedRestaurant()).resolves.toBe(restaurant);
    expect(mockedRequest).toHaveBeenCalledWith({
      method: "GET",
      route: "/restaurants/me",
    });
  });

  it("normalizes an absent owned restaurant to null", async () => {
    mockedRequest.mockRejectedValue(new VaptApiClientError("not_found", "Restaurant not found", 404));

    await expect(fetchOwnedRestaurant()).resolves.toBeNull();
  });

  it("creates onboarding and patches only camelCase restaurant data", async () => {
    mockedRequest.mockResolvedValue(restaurant);
    const onboarding = {
      restaurantName: "Vapt Burger",
      slug: "vapt-burger",
      dishName: "X-Burguer",
      dishPrice: "29.90",
    };

    await createOnboarding(onboarding);
    await updateOwnedRestaurant({ deliveryEnabled: true, maxTables: 20 });

    expect(mockedRequest).toHaveBeenNthCalledWith(1, {
      method: "POST",
      route: "/onboarding",
      body: onboarding,
    });
    expect(mockedRequest).toHaveBeenNthCalledWith(2, {
      method: "PATCH",
      route: "/restaurants/me",
      body: { deliveryEnabled: true, maxTables: 20 },
    });
  });
});
