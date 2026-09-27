import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useSubscription } from "@/hooks/useSubscription";
const auth = vi.hoisted(() => ({ user: { id: "owner-1" } }));
const getStatus = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/lib/restaurants", () => ({ fetchOwnedRestaurant: async () => ({ id: "restaurant-1", planType: "business", planStatus: "active" }) }));
vi.mock("@/lib/billing-client", () => ({ billingClient: { getSubscriptionStatus: getStatus } }));
beforeEach(() => { auth.user = { id: crypto.randomUUID() }; getStatus.mockReset(); });
afterEach(cleanup);
it("uses safe billing snapshot instead of restaurant fallback entitlement", async () => {
  getStatus.mockResolvedValue({ planType: "pro", planStatus: "past_due", trialEndsAt: null,
    currentPeriodEnd: "2030-01-01T00:00:00.000Z", cancelAtPeriodEnd: false,
    subscriptionCanceledAt: null, canManageBilling: true, requiresBillingAction: true });
  const { result } = renderHook(useSubscription);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(getStatus).toHaveBeenCalledWith("restaurant-1");
  expect(result.current.planType).toBe("pro"); expect(result.current.planStatus).toBe("past_due");
  expect(result.current.canManageBilling).toBe(true); expect(result.current.requiresBillingAction).toBe(true);
  expect(result.current.isActive).toBe(false); expect(result.current.canAccess("metrics")).toBe(false);
});
it("keeps a local trial usable without claiming a Stripe billing Customer", async () => {
  getStatus.mockResolvedValue({ planType: "starter", planStatus: "trialing", trialEndsAt: "2030-01-01T00:00:00.000Z",
    currentPeriodEnd: null, cancelAtPeriodEnd: false, subscriptionCanceledAt: null,
    canManageBilling: false, requiresBillingAction: false });
  const { result } = renderHook(useSubscription);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.isTrialing).toBe(true); expect(result.current.canManageBilling).toBe(false);
});
it("fails closed on billing read failure and never reuses active cached entitlements", async () => {
  getStatus.mockRejectedValue(new Error("provider unavailable"));
  const { result } = renderHook(useSubscription);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.isActive).toBe(false); expect(result.current.canManageBilling).toBe(false);
});
