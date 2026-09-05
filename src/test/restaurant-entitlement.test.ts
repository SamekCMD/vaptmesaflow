import { describe, expect, it } from "vitest";

import { PLANS } from "@/lib/plans";

describe("restaurant plan entitlements", () => {
  it("keeps multi-restaurant exclusive to Business", () => {
    expect(Object.fromEntries(PLANS.map((plan) => [plan.id, plan.maxRestaurants]))).toEqual({
      starter: 1,
      pro: 1,
      business: 25,
    });
  });
});
