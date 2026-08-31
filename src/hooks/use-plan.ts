import { useCallback } from "react";

import { useSubscription } from "@/hooks/useSubscription";

export type PlanType = "starter" | "pro" | "business";
export type PlanStatus = "trialing" | "active" | "expired" | "cancelled";

type Feature = "cashier" | "open_tab" | "multi_users";

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

const canonicalFeature: Record<Feature, string> = {
  cashier: "cashier",
  open_tab: "open_tab",
  multi_users: "multi_user",
};

export function usePlan(): PlanData {
  const subscription = useSubscription();
  const planType: PlanType = subscription.planType === "trial" ? "starter" : subscription.planType;
  const planStatus: PlanStatus =
    subscription.planStatus === "canceled" ? "cancelled" : subscription.planStatus;
  const trialLabel =
    planStatus === "trialing"
      ? subscription.trialDaysLeft > 1
        ? `${subscription.trialDaysLeft} dias restantes de teste`
        : subscription.trialDaysLeft === 1
          ? "Seu teste expira amanhã!"
          : "Seu teste expirou"
      : "";
  const canAccess = useCallback(
    (feature: Feature) => subscription.canAccess(canonicalFeature[feature]),
    [subscription],
  );

  return {
    planType,
    planStatus,
    trialEndsAt: subscription.trialEndsAt,
    restaurantId: subscription.restaurantId,
    isActive: subscription.isActive,
    trialDaysLeft: subscription.trialDaysLeft,
    trialLabel,
    canAccess,
    loading: subscription.loading,
    refetch: subscription.refetch,
  };
}
