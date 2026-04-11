import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export type PlanType = "starter" | "pro" | "business";
export type PlanStatus = "trialing" | "active" | "expired" | "cancelled";

type Feature = "cashier" | "open_tab" | "multi_users";

const PLAN_HIERARCHY: Record<PlanType, number> = {
  starter: 0,
  pro: 1,
  business: 2,
};

const FEATURE_MIN_PLAN: Record<Feature, PlanType> = {
  cashier: "pro",
  open_tab: "pro",
  multi_users: "business",
};

export const PLAN_LABELS: Record<PlanType, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

interface PlanData {
  planType: PlanType;
  planStatus: PlanStatus;
  trialEndsAt: Date | null;
  restaurantId: string | null;
  isActive: boolean;
  trialDaysLeft: number;
  trialLabel: string;
  canAccess: (feature: Feature) => boolean;
  loading: boolean;
  refetch: () => void;
}

type RestaurantPlanRow = {
  id: string;
  plan_type: PlanType | null;
  plan_status: PlanStatus | null;
  trial_ends_at: string | null;
};

export function usePlan(): PlanData {
  const { user } = useAuth();
  const [planType, setPlanType] = useState<PlanType>("starter");
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
      const row = data as RestaurantPlanRow;
      setRestaurantId(row.id);
      setPlanType(row.plan_type || "starter");
      setPlanStatus(row.plan_status || "trialing");
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

  const isActive =
    planStatus === "active" ||
    (planStatus === "trialing" && trialEndsAt !== null && trialEndsAt > now);

  const trialLabel =
    planStatus === "trialing"
      ? trialDaysLeft > 1
        ? `${trialDaysLeft} dias restantes de teste`
        : trialDaysLeft === 1
        ? "Seu teste expira amanhã!"
        : "Seu teste expirou"
      : "";

  const canAccess = useCallback(
    (feature: Feature): boolean => {
      const currentNow = new Date();
      if (planStatus === "trialing" && trialEndsAt && trialEndsAt > currentNow) return true;
      if (planStatus !== "active") return false;
      const required = FEATURE_MIN_PLAN[feature];
      return PLAN_HIERARCHY[planType] >= PLAN_HIERARCHY[required];
    },
    [planType, planStatus, trialEndsAt]
  );

  return {
    planType,
    planStatus,
    trialEndsAt,
    restaurantId,
    isActive,
    trialDaysLeft,
    trialLabel,
    canAccess,
    loading,
    refetch: fetchPlan,
  };
}
