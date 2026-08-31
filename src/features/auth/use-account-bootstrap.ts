import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

import {
  deriveAccountBootstrap,
  type AccountBootstrap,
  type AccountBootstrapOrganization,
  type AccountBootstrapRestaurant,
  type MembershipRole,
} from "./account-bootstrap-query";
import {
  fetchAccountPreference,
  getRouteRestaurantId,
  saveAccountPreference,
} from "./account-preferences";

type OrganizationMembershipRow = {
  organization_id: string;
  role: MembershipRole;
  organizations: {
    id: string;
    name: string;
  } | null;
};

type RestaurantRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  onboarding_completed: boolean | null;
};

async function fetchAccountBootstrap(userId: string, routeRestaurantId: string | null): Promise<AccountBootstrap> {
  const [membershipResponse, preference] = await Promise.all([
    supabase
      .from("organization_members")
      .select("organization_id, role, organizations(id, name)")
      .eq("user_id", userId)
      .eq("status", "active"),
    fetchAccountPreference(userId),
  ]);

  if (membershipResponse.error) {
    throw membershipResponse.error;
  }

  const memberships = (membershipResponse.data ?? []) as OrganizationMembershipRow[];
  const organizations: AccountBootstrapOrganization[] = memberships
    .map((membership) => {
      if (!membership.organizations) return null;
      return {
        id: membership.organizations.id,
        name: membership.organizations.name,
        role: membership.role,
      };
    })
    .filter((organization): organization is AccountBootstrapOrganization => organization !== null);

  const organizationIds = organizations.map((organization) => organization.id);
  let restaurants: AccountBootstrapRestaurant[] = [];

  if (organizationIds.length > 0) {
    const restaurantResponse = await supabase
      .from("restaurants")
      .select("id, organization_id, name, slug, onboarding_completed")
      .in("organization_id", organizationIds);

    if (restaurantResponse.error) {
      throw restaurantResponse.error;
    }

    restaurants = ((restaurantResponse.data ?? []) as RestaurantRow[]).map((restaurant) => ({
      id: restaurant.id,
      organizationId: restaurant.organization_id,
      name: restaurant.name,
      slug: restaurant.slug,
      onboardingStatus: restaurant.onboarding_completed ? "complete" : "draft",
    }));
  }

  const bootstrap = deriveAccountBootstrap({
    userId,
    organizations,
    restaurants,
    preferredOrganizationId: preference.currentOrganizationId,
    preferredRestaurantId: preference.currentRestaurantId,
    routeRestaurantId,
  });

  await saveAccountPreference(userId, {
    currentOrganizationId: bootstrap.currentOrganizationId,
    currentRestaurantId: bootstrap.currentRestaurantId,
  });

  return bootstrap;
}

export function useAccountBootstrap(routeRestaurantId?: string | null) {
  const { recoveryMode, user } = useAuth();
  const effectiveRouteRestaurantId =
    routeRestaurantId === undefined && typeof window !== "undefined"
      ? getRouteRestaurantId(window.location.href)
      : routeRestaurantId ?? null;

  return useQuery({
    queryKey: ["account-bootstrap", user?.id ?? null, effectiveRouteRestaurantId],
    queryFn: async () => {
      if (!user) return null;
      return fetchAccountBootstrap(user.id, effectiveRouteRestaurantId);
    },
    enabled: Boolean(user) && !recoveryMode,
    staleTime: 30_000,
  });
}
