import { describe, expect, it } from "vitest";

import { getRouteRestaurantId } from "@/features/auth/account-preferences";

describe("account preferences", () => {
  it("reads the authoritative restaurant id from the URL", () => {
    expect(getRouteRestaurantId("https://vapt.test/dashboard?restaurantId=restaurant-2")).toBe(
      "restaurant-2",
    );
  });

  it("ignores an empty restaurant id in the URL", () => {
    expect(getRouteRestaurantId("https://vapt.test/dashboard?restaurantId=")).toBeNull();
  });
});
