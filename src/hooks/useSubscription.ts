import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

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

export function useSubscription(): SubscriptionData {
  const { user } = useAuth();
  const [planType, setPlanType] = useState<PlanType>("trial");
  const [planStatus, setPlanStatus] = useState<PlanStatus>("trialing");
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("restaurants")
      .select("id, plan_type, plan_status, trial_ends_at")
      .eq("owner_id", user.id)
      .single();

    if (data) {
      const row = data as RestaurantSubscriptionRow;
      setRestaurantId(row.id);
      const pt = row.plan_type || "starter";
      const ps = row.plan_status || "trialing";
      setPlanType(ps === "trialing" ? "trial" : pt);
      setPlanStatus(ps);
      setTrialEndsAt(row.trial_ends_at ? new Date(row.trial_ends_at) : null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const now = new Date();
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const isTrialing = planStatus === "trialing" && trialEndsAt !== null && trialEndsAt > now;

  const isActive =
    planStatus === "active" || isTrialing;

  const canAccess = useCallback(
    (feature: string): boolean => {
      if (isTrialing) return true;
      if (planStatus !== "active") return false;
      const allowed = featureAccess[feature];
      if (!allowed) return true;
      const actualPlan = planType === "trial" ? "starter" : planType;
      return allowed.includes(actualPlan);
    },
    [planType, planStatus, isTrialing]
  );

  return {
    planType,
    planStatus,
    trialEndsAt,
    trialDaysLeft,
    isTrialing,
    isActive,
    restaurantId,
    canAccess,
    loading,
    refetch: fetchPlan,
  };
}
