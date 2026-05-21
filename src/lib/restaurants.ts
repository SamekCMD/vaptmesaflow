import { supabase } from "@/lib/supabase";

type RestaurantLike = {
  owner_id: string;
  plan_status?: string | null;
  trial_ends_at?: string | null;
  updated_at?: string | null;
};

const normalizePlanStatus = (planStatus: string | null | undefined): string | null => {
  if (typeof planStatus !== "string") return null;
  const normalized = planStatus.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const getRestaurantPriority = (restaurant: RestaurantLike): number => {
  const planStatus = normalizePlanStatus(restaurant.plan_status);

  if (planStatus === "active") return 3;

  if (planStatus === "trialing") {
    if (!restaurant.trial_ends_at) return 2;

    const trialEndsAt = new Date(restaurant.trial_ends_at);
    if (!Number.isNaN(trialEndsAt.getTime()) && trialEndsAt > new Date()) {
      return 2;
    }
  }

  return 1;
};

const compareRestaurants = (left: RestaurantLike, right: RestaurantLike): number => {
  const priorityDelta = getRestaurantPriority(right) - getRestaurantPriority(left);
  if (priorityDelta !== 0) return priorityDelta;

  const leftUpdatedAt = left.updated_at ? new Date(left.updated_at).getTime() : 0;
  const rightUpdatedAt = right.updated_at ? new Date(right.updated_at).getTime() : 0;

  return rightUpdatedAt - leftUpdatedAt;
};

export async function fetchOwnedRestaurant<T extends RestaurantLike>(
  ownerId: string,
  select: string,
): Promise<T | null> {
  const { data, error } = await supabase
    .from("restaurants")
    .select(select)
    .eq("owner_id", ownerId);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const restaurants = (data as T[]).slice().sort(compareRestaurants);
  return restaurants[0] ?? null;
}
