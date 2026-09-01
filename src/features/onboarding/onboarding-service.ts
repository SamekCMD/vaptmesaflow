import { supabase } from "@/lib/supabase";

export type OnboardingDraft = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  whatsapp: string;
  primaryColor: string;
  secondaryColor: string;
  totalTables: number;
  onboardingStep: number;
};

export type SaveOnboardingDraftInput = Omit<OnboardingDraft, "id" | "organizationId"> & {
  restaurantId: string | null;
  organizationId: string | null;
};

type OnboardingDraftRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  whatsapp: string | null;
  primary_color: string;
  secondary_color: string;
  total_tables: number;
  onboarding_step: number;
};

const mapDraft = (row: OnboardingDraftRow): OnboardingDraft => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  slug: row.slug,
  whatsapp: row.whatsapp ?? "",
  primaryColor: row.primary_color,
  secondaryColor: row.secondary_color,
  totalTables: row.total_tables,
  onboardingStep: row.onboarding_step,
});

export async function fetchOnboardingDraft(restaurantId: string | null) {
  if (!restaurantId) return null;

  const { data, error } = await supabase
    .from("restaurants")
    .select("id, organization_id, name, slug, whatsapp, primary_color, secondary_color, total_tables, onboarding_step")
    .eq("id", restaurantId)
    .eq("onboarding_status", "draft")
    .maybeSingle();

  if (error) throw error;
  return data ? mapDraft(data as OnboardingDraftRow) : null;
}

export async function saveOnboardingDraft(input: SaveOnboardingDraftInput) {
  const { data, error } = await supabase.rpc("save_onboarding_draft", {
    p_name: input.name,
    p_slug: input.slug,
    p_onboarding_step: input.onboardingStep,
    p_restaurant_id: input.restaurantId,
    p_organization_id: input.organizationId,
    p_whatsapp: input.whatsapp || null,
    p_primary_color: input.primaryColor,
    p_secondary_color: input.secondaryColor,
    p_total_tables: input.totalTables,
  });

  if (error) throw error;
  const row = data?.[0] as OnboardingDraftRow | undefined;
  if (!row) throw new Error("O rascunho do onboarding não foi retornado.");
  return mapDraft(row);
}

