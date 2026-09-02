import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchOnboardingDraft,
  finalizeOnboarding,
  saveOnboardingDraft,
} from "./onboarding-service";

export const onboardingDraftQueryKey = (restaurantId: string | null) =>
  ["onboarding-draft", restaurantId] as const;

export function useOnboardingDraft(restaurantId: string | null) {
  return useQuery({
    queryKey: onboardingDraftQueryKey(restaurantId),
    queryFn: () => fetchOnboardingDraft(restaurantId),
    enabled: Boolean(restaurantId),
  });
}

export function useSaveOnboardingDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveOnboardingDraft,
    onSuccess: (draft) => {
      queryClient.setQueryData(onboardingDraftQueryKey(draft.id), draft);
      void queryClient.invalidateQueries({ queryKey: ["account-bootstrap"] });
    },
  });
}

export function useFinalizeOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: finalizeOnboarding,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["account-bootstrap"] });
      void queryClient.invalidateQueries({ queryKey: onboardingDraftQueryKey(result.id) });
    },
  });
}
