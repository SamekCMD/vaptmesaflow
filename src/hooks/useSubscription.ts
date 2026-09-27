import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchOwnedRestaurant } from "@/lib/restaurants";
import { billingClient, type BillingPlanStatus } from "@/lib/billing-client";

const SUBSCRIPTION_UPDATED_EVENT = "vapt:subscription-updated";
export type PlanType = "starter" | "pro" | "business" | "trial";
export type PlanStatus = BillingPlanStatus;
const featureAccess: Record<string, string[]> = {
  cashier: ["pro", "business"], open_tab: ["pro", "business"], metrics: ["pro", "business"],
  multi_user: ["business"], advanced_reports: ["business"],
};
export interface SubscriptionData {
  planType: PlanType; planStatus: PlanStatus; trialEndsAt: Date | null;
  trialDaysLeft: number; isTrialing: boolean; isActive: boolean; restaurantId: string | null;
  currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean; subscriptionCanceledAt: Date | null;
  canManageBilling: boolean; canStartCheckout: boolean; requiresBillingAction: boolean;
  billingError: string | null; canAccess: (feature: string) => boolean; loading: boolean;
  refetch: () => Promise<void>;
}
type SubscriptionSnapshot = Pick<SubscriptionData,
  "planType" | "planStatus" | "trialEndsAt" | "restaurantId" | "loading" |
  "currentPeriodEnd" | "cancelAtPeriodEnd" | "subscriptionCanceledAt" |
  "canManageBilling" | "canStartCheckout" | "requiresBillingAction" | "billingError">;
const DEFAULT_SNAPSHOT: SubscriptionSnapshot = {
  planType: "starter", planStatus: "expired", trialEndsAt: null, restaurantId: null,
  currentPeriodEnd: null, cancelAtPeriodEnd: false, subscriptionCanceledAt: null,
  canManageBilling: false, canStartCheckout: false, requiresBillingAction: false, billingError: null, loading: true,
};
let subscriptionSnapshot = { ...DEFAULT_SNAPSHOT };
let snapshotUserId: string | null = null;
let generation = 0;
let inFlightFetch: { userId: string; promise: Promise<void> } | null = null;
const listeners = new Set<(snapshot: SubscriptionSnapshot) => void>();
function setSnapshot(partial: Partial<SubscriptionSnapshot>) {
  subscriptionSnapshot = { ...subscriptionSnapshot, ...partial };
  listeners.forEach(listener => listener(subscriptionSnapshot));
}
function selectUser(userId: string | null) {
  if (snapshotUserId === userId) return;
  snapshotUserId = userId;
  generation++;
  inFlightFetch = null;
  setSnapshot({ ...DEFAULT_SNAPSHOT, loading: userId !== null });
}
async function loadSubscriptionSnapshot(userId: string): Promise<void> {
  selectUser(userId);
  if (inFlightFetch?.userId === userId) return inFlightFetch.promise;
  const currentGeneration = generation;
  setSnapshot({ loading: true, billingError: null });
  const promise = (async () => {
    try {
      const restaurant = await fetchOwnedRestaurant();
      const billing = restaurant ? await billingClient.getSubscriptionStatus(restaurant.id) : null;
      // An old owner's response must never overwrite the next authenticated owner.
      if (currentGeneration !== generation) return;
      if (!restaurant || !billing) {
        setSnapshot({ ...DEFAULT_SNAPSHOT, loading: false });
        return;
      }
      setSnapshot({
        restaurantId: restaurant.id, planType: billing.planStatus === "trialing" ? "trial" : billing.planType,
        planStatus: billing.planStatus, trialEndsAt: billing.trialEndsAt ? new Date(billing.trialEndsAt) : null,
        currentPeriodEnd: billing.currentPeriodEnd ? new Date(billing.currentPeriodEnd) : null,
        cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
        subscriptionCanceledAt: billing.subscriptionCanceledAt ? new Date(billing.subscriptionCanceledAt) : null,
        canManageBilling: billing.canManageBilling, canStartCheckout: billing.canStartCheckout, requiresBillingAction: billing.requiresBillingAction,
        billingError: null, loading: false,
      });
    } catch {
      if (currentGeneration === generation) setSnapshot({
        ...DEFAULT_SNAPSHOT, loading: false,
        billingError: "Não foi possível carregar sua assinatura. Tente novamente.",
      });
    } finally {
      if (currentGeneration === generation) inFlightFetch = null;
    }
  })();
  inFlightFetch = { userId, promise };
  return promise;
}
export function useSubscription(): SubscriptionData {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [snapshot, setLocalSnapshot] = useState<SubscriptionSnapshot>(subscriptionSnapshot);
  const fetchPlan = useCallback(async () => {
    selectUser(userId);
    if (userId) await loadSubscriptionSnapshot(userId);
    else setSnapshot({ ...DEFAULT_SNAPSHOT, loading: false });
  }, [userId]);
  const refetch = useCallback(async () => { await fetchPlan(); }, [fetchPlan]);
  useEffect(() => {
    listeners.add(setLocalSnapshot);
    void fetchPlan();
    setLocalSnapshot(subscriptionSnapshot);
    const onRefresh = () => { void fetchPlan(); };
    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      listeners.delete(setLocalSnapshot);
      window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [fetchPlan]);
  // Do not render a different owner's cached entitlement before effects run.
  const visible = snapshotUserId === userId ? snapshot : DEFAULT_SNAPSHOT;
  const now = new Date();
  const trialDaysLeft = visible.trialEndsAt
    ? Math.max(0, Math.ceil((visible.trialEndsAt.getTime() - now.getTime()) / 86_400_000)) : 0;
  const isTrialing = visible.planStatus === "trialing" && visible.trialEndsAt !== null && visible.trialEndsAt > now;
  const isActive = visible.planStatus === "active" || isTrialing;
  const canAccess = useCallback((feature: string) => {
    if (isTrialing) return true;
    if (visible.planStatus !== "active") return false;
    const allowed = featureAccess[feature];
    return !allowed || allowed.includes(visible.planType === "trial" ? "starter" : visible.planType);
  }, [isTrialing, visible.planStatus, visible.planType]);
  return { ...visible, trialDaysLeft, isTrialing, isActive, canAccess, refetch };
}
