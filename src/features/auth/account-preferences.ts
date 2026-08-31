import { supabase } from "@/lib/supabase";

export type AccountPreference = {
  currentOrganizationId: string | null;
  currentRestaurantId: string | null;
};

type AccountPreferenceRow = {
  current_organization_id: string | null;
  current_restaurant_id: string | null;
};

export function getRouteRestaurantId(href: string): string | null {
  try {
    const value = new URL(href).searchParams.get("restaurantId")?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export async function fetchAccountPreference(userId: string): Promise<AccountPreference> {
  const { data, error } = await supabase
    .from("account_preferences")
    .select("current_organization_id, current_restaurant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  const row = data as AccountPreferenceRow | null;
  return {
    currentOrganizationId: row?.current_organization_id ?? null,
    currentRestaurantId: row?.current_restaurant_id ?? null,
  };
}

export async function saveAccountPreference(
  userId: string,
  preference: AccountPreference,
): Promise<void> {
  const { error } = await supabase.from("account_preferences").upsert(
    {
      user_id: userId,
      current_organization_id: preference.currentOrganizationId,
      current_restaurant_id: preference.currentRestaurantId,
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}
