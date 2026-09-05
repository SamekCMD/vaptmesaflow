import { Navigate, useSearchParams } from "react-router-dom";

import { AccountBootstrapError } from "@/features/auth/AccountBootstrapError";
import OnboardingPage from "@/pages/onboarding/OnboardingPage";
import { useRestaurantCreationEntitlement } from "./restaurant-entitlement";

const NewRestaurantPage = () => {
  const [searchParams] = useSearchParams();
  const organizationId = searchParams.get("organizationId")?.trim() || null;
  const entitlementQuery = useRestaurantCreationEntitlement(organizationId);

  if (!organizationId) return <Navigate to="/dashboard" replace />;
  if (entitlementQuery.isLoading) return <div className="min-h-screen bg-background" />;
  if (entitlementQuery.isError || !entitlementQuery.data) {
    return <AccountBootstrapError onRetry={() => void entitlementQuery.refetch()} />;
  }
  if (!entitlementQuery.data.canCreate) {
    return (
      <Navigate
        to={entitlementQuery.data.reason === "plan_limit" ? "/dashboard/subscription" : "/dashboard"}
        replace
      />
    );
  }

  return <OnboardingPage creationOrganizationId={organizationId} />;
};

export default NewRestaurantPage;
