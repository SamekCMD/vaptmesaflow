import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePlan } from "@/hooks/use-plan";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    planType: "business",
    planStatus: "active",
    trialEndsAt: null,
    trialDaysLeft: 0,
    isActive: true,
    restaurantId: "restaurant-selected",
    loading: false,
    refetch: vi.fn(),
  }),
}));

describe("usePlan", () => {
  it("adapts the canonical organization subscription", () => {
    const { result } = renderHook(() => usePlan());

    expect(result.current.planType).toBe("business");
    expect(result.current.planStatus).toBe("active");
    expect(result.current.restaurantId).toBe("restaurant-selected");
  });
});
