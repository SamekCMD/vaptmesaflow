import { supabase } from "@/lib/supabase";
import {
  EMPTY_GUIDE_PROGRESS,
  GUIDE_MODULES,
  type GuideModule,
  type OnboardingGuideProgress,
} from "@/lib/onboarding";

type ActivationProgressRow = {
  module_key: string;
};

export function mapActivationProgress(
  rows: ActivationProgressRow[],
): OnboardingGuideProgress {
  const progress = { ...EMPTY_GUIDE_PROGRESS };

  for (const row of rows) {
    if (GUIDE_MODULES.includes(row.module_key as GuideModule)) {
      progress[row.module_key as GuideModule] = true;
    }
  }

  return progress;
}

export async function fetchActivationProgress(
  restaurantId: string,
): Promise<OnboardingGuideProgress> {
  const { data, error } = await supabase
    .from("restaurant_activation_progress")
    .select("module_key")
    .eq("restaurant_id", restaurantId);

  if (error) throw error;
  return mapActivationProgress((data ?? []) as ActivationProgressRow[]);
}

export async function completeActivationModule(
  restaurantId: string,
  module: GuideModule,
): Promise<void> {
  const { error } = await supabase
    .from("restaurant_activation_progress")
    .insert({ restaurant_id: restaurantId, module_key: module });

  if (error && error.code !== "23505") throw error;
}
