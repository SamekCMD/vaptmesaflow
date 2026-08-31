import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAccountBootstrap } from "@/features/auth/use-account-bootstrap";
import { supabase } from "@/lib/supabase";

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

type OrganizationSubscriptionRow = {
  organization_id: string;
  plan_type: string | null;
  plan_status: string | null;
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

async function fetchOrganizationSubscription(
  organizationId: string,
): Promise<OrganizationSubscriptionRow | null> {
  const response = await supabase
    .from("organization_subscriptions")
    .select("organization_id, plan_type, plan_status, trial_ends_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  return response.data as OrganizationSubscriptionRow | null;
}

export function useSubscription(): SubscriptionData {
  const bootstrapQuery = useAccountBootstrap();
  const organizationId = bootstrapQuery.data?.currentOrganizationId ?? null;
  const restaurantId = bootstrapQuery.data?.currentRestaurantId ?? null;
  const subscriptionQuery = useQuery({
    queryKey: ["organization-subscription", organizationId],
    queryFn: () => fetchOrganizationSubscription(organizationId as string),
    enabled: organizationId !== null,
    staleTime: 30_000,
  });

  const row = subscriptionQuery.data;
  const planStatus = normalizePlanStatus(row?.plan_status);
  const normalizedPlanType = normalizePlanType(row?.plan_type);
  const planType: PlanType = planStatus === "trialing" ? "trial" : normalizedPlanType;
  const trialEndsAt = row?.trial_ends_at ? new Date(row.trial_ends_at) : null;
  const now = new Date();
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const isTrialing = planStatus === "trialing" && trialEndsAt !== null && trialEndsAt > now;
  const isActive = planStatus === "active" || isTrialing;

  const canAccess = useCallback(
    (feature: string): boolean => {
      if (isTrialing) return true;
      if (planStatus !== "active") return false;
      const allowed = featureAccess[feature];
      if (!allowed) return true;
      const actualPlan = planType === "trial" ? "starter" : planType;
      return allowed.includes(actualPlan);
    },
    [isTrialing, planStatus, planType],
  );

  const refetch = useCallback(() => {
    void subscriptionQuery.refetch();
  }, [subscriptionQuery]);

  return {
    planType,
    planStatus,
    trialEndsAt,
    trialDaysLeft,
    isTrialing,
    isActive,
    restaurantId,
    canAccess,
    loading: bootstrapQuery.isLoading || (organizationId !== null && subscriptionQuery.isPending),
    refetch,
  };
}
