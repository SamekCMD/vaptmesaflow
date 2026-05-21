import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchOwnedRestaurant } from "@/lib/restaurants";

const SUBSCRIPTION_UPDATED_EVENT = "vapt:subscription-updated";

export type PlanType = "starter" | "pro" | "business" | "trial";
export type PlanStatus = "trialing" | "active" | "canceled" | "expired";

const featureAccess: Record<string, string[]> = {
  cashier: ["pro", "business"],
  open_tab: ["pro", "business"],
  metrics: ["pro", "business"],
  multi_user: ["business"],
  advanced_reports: ["business"],
};

export interface SubscriptionData {
  planType: PlanType;
  planStatus: PlanStatus;
  trialEndsAt: Date | null;
  trialDaysLeft: number;
  isTrialing: boolean;
  isActive: boolean;
  restaurantId: string | null;
  canAccess: (feature: string) => boolean;
  loading: boolean;
  refetch: () => void;
}

type RestaurantSubscriptionRow = {
  id: string;
  plan_type: Exclude<PlanType, "trial"> | null;
  plan_status: PlanStatus | null;
  trial_ends_at: string | null;
};

const normalizePlanType = (
  planType: string | null | undefined,
): Exclude<PlanType, "trial"> | "starter" => {
  if (typeof planType !== "string") return "starter";
  const normalized = planType.trim().toLowerCase();
  return normalized === "starter" || normalized === "pro" || normalized === "business"
    ? normalized
    : "starter";
};

const normalizePlanStatus = (planStatus: string | null | undefined): PlanStatus => {
  if (typeof planStatus !== "string") return "trialing";
  const normalized = planStatus.trim().toLowerCase();

  if (
    normalized === "trialing" ||
    normalized === "active" ||
    normalized === "canceled" ||
    normalized === "expired"
  ) {
    return normalized;
  }

  return "trialing";
};

type SubscriptionSnapshot = {
  planType: PlanType;
  planStatus: PlanStatus;
  trialEndsAt: Date | null;
  restaurantId: string | null;
  loading: boolean;
};

const DEFAULT_SNAPSHOT: SubscriptionSnapshot = {
  planType: "trial",
  planStatus: "trialing",
  trialEndsAt: null,
  restaurantId: null,
  loading: true,
};

let subscriptionSnapshot: SubscriptionSnapshot = DEFAULT_SNAPSHOT;
let inFlightFetch: Promise<void> | null = null;
const listeners = new Set<(snapshot: SubscriptionSnapshot) => void>();

const emitSnapshot = () => {
  listeners.forEach((listener) => listener(subscriptionSnapshot));
};

const setSnapshot = (partial: Partial<SubscriptionSnapshot>) => {
  subscriptionSnapshot = { ...subscriptionSnapshot, ...partial };
  emitSnapshot();
};

const resetSnapshot = () => {
  subscriptionSnapshot = { ...DEFAULT_SNAPSHOT, loading: false };
  emitSnapshot();
};

async function loadSubscriptionSnapshot(userId: string): Promise<void> {
  if (inFlightFetch) {
    return inFlightFetch;
  }

  inFlightFetch = (async () => {
    try {
      const data = await fetchOwnedRestaurant<RestaurantSubscriptionRow & { owner_id: string }>(
        userId,
        "id, owner_id, plan_type, plan_status, trial_ends_at, updated_at",
      );

      if (import.meta.env.DEV) {
        console.info("[useSubscription] selected restaurant", {
          userId,
          restaurant: data,
        });
      }

      if (data) {
        const row = data as RestaurantSubscriptionRow;
        const planStatus = normalizePlanStatus(row.plan_status);
        const planType = normalizePlanType(row.plan_type);

        setSnapshot({
          restaurantId: row.id,
          planType: planStatus === "trialing" ? "trial" : planType,
          planStatus,
          trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at) : null,
          loading: false,
        });
      } else {
        resetSnapshot();
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[useSubscription] failed to fetch restaurant subscription", error);
      }
      resetSnapshot();
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}

export function useSubscription(): SubscriptionData {
  const { user } = useAuth();
  const [snapshot, setLocalSnapshot] = useState<SubscriptionSnapshot>(subscriptionSnapshot);

  const fetchPlan = useCallback(async () => {
    if (!user) {
      resetSnapshot();
      return;
    }
    setSnapshot({ loading: true });
    await loadSubscriptionSnapshot(user.id);
  }, [user]);

  const refetch = useCallback(async () => {
    await fetchPlan();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SUBSCRIPTION_UPDATED_EVENT));
    }
  }, [fetchPlan]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  useEffect(() => {
    const listener = (nextSnapshot: SubscriptionSnapshot) => {
      setLocalSnapshot(nextSnapshot);
    };

    listeners.add(listener);

    if (typeof window === "undefined") return;

    const handleSubscriptionUpdated = () => {
      fetchPlan();
    };

    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, handleSubscriptionUpdated);

    return () => {
      listeners.delete(listener);
      window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, handleSubscriptionUpdated);
    };
  }, [fetchPlan]);

  const now = new Date();
  const trialDaysLeft = snapshot.trialEndsAt
    ? Math.max(0, Math.ceil((snapshot.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isTrialing =
    snapshot.planStatus === "trialing" &&
    snapshot.trialEndsAt !== null &&
    snapshot.trialEndsAt > now;

  const isActive = snapshot.planStatus === "active" || isTrialing;

  const canAccess = useCallback(
    (feature: string): boolean => {
      if (isTrialing) return true;
      if (snapshot.planStatus !== "active") return false;
      const allowed = featureAccess[feature];
      if (!allowed) return true;
      const actualPlan = snapshot.planType === "trial" ? "starter" : snapshot.planType;
      return allowed.includes(actualPlan);
    },
    [isTrialing, snapshot.planStatus, snapshot.planType]
  );

  return {
    planType: snapshot.planType,
    planStatus: snapshot.planStatus,
    trialEndsAt: snapshot.trialEndsAt,
    trialDaysLeft,
    isTrialing,
    isActive,
    restaurantId: snapshot.restaurantId,
    canAccess,
    loading: snapshot.loading,
    refetch,
  };
}
