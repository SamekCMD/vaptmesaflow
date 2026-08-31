import { describe, expect, it } from "vitest";

import { resolveCurrentRestaurant } from "@/features/restaurants/current-restaurant";

describe("resolveCurrentRestaurant", () => {
  it("returns only the restaurant selected by account bootstrap", () => {
    const restaurant = resolveCurrentRestaurant({
      userId: "user-1",
      organizations: [{ id: "org-1", name: "Org", role: "owner" }],
      currentOrganizationId: "org-1",
      restaurants: [
        {
          id: "restaurant-first",
          organizationId: "org-1",
          name: "First",
          slug: "first",
          onboardingStatus: "complete",
        },
        {
          id: "restaurant-selected",
          organizationId: "org-1",
          name: "Selected",
          slug: "selected",
          onboardingStatus: "complete",
        },
      ],
      currentRestaurantId: "restaurant-selected",
      destination: "dashboard",
    });

    expect(restaurant?.id).toBe("restaurant-selected");
    expect(restaurant?.slug).toBe("selected");
  });

  it("returns null when bootstrap has no current restaurant", () => {
    expect(
      resolveCurrentRestaurant({
        userId: "user-1",
        organizations: [{ id: "org-1", name: "Org", role: "owner" }],
        currentOrganizationId: "org-1",
        restaurants: [],
        currentRestaurantId: null,
        destination: "onboarding",
      }),
    ).toBeNull();
  });
});
