import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export type RestaurantCreationEntitlement = {
  canCreate: boolean;
  role: "owner" | "admin" | "manager" | "staff" | null;
  planType: string | null;
  currentRestaurants: number | null;
  maxRestaurants: number | null;
  reason: "membership_required" | "role_denied" | "plan_limit" | null;
};

type RestaurantCreationEntitlementRow = {
  can_create: boolean;
  role: RestaurantCreationEntitlement["role"];
  plan_type: string | null;
  current_restaurants: number | null;
  max_restaurants: number | null;
  reason: RestaurantCreationEntitlement["reason"];
};

export async function fetchRestaurantCreationEntitlement(
  organizationId: string,
): Promise<RestaurantCreationEntitlement> {
  const { data, error } = await supabase.rpc("get_restaurant_creation_entitlement", {
    p_organization_id: organizationId,
  });

  if (error) throw error;
  const row = data?.[0] as RestaurantCreationEntitlementRow | undefined;
  if (!row) throw new Error("A permissão para criar restaurantes não foi retornada.");

  return {
    canCreate: row.can_create,
    role: row.role,
    planType: row.plan_type,
    currentRestaurants: row.current_restaurants,
    maxRestaurants: row.max_restaurants,
    reason: row.reason,
  };
}

export function useRestaurantCreationEntitlement(organizationId: string | null) {
  return useQuery({
    queryKey: ["restaurant-creation-entitlement", organizationId],
    queryFn: () => fetchRestaurantCreationEntitlement(organizationId as string),
    enabled: organizationId !== null,
    staleTime: 30_000,
  });
}
