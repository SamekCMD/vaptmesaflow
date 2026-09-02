import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  markGuideModuleComplete,
  type GuideModule,
  type OnboardingGuideProgress,
} from "@/lib/onboarding";
import {
  completeActivationModule,
  fetchActivationProgress,
} from "./activation-progress-service";

export const activationProgressQueryKey = (restaurantId: string | null) =>
  ["restaurant-activation-progress", restaurantId] as const;

export function useActivationProgress(restaurantId: string | null) {
  return useQuery({
    queryKey: activationProgressQueryKey(restaurantId),
    queryFn: () => fetchActivationProgress(restaurantId as string),
    enabled: Boolean(restaurantId),
  });
}

export function useCompleteActivationModule(restaurantId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (module: GuideModule) => {
      if (!restaurantId) throw new Error("Restaurante atual indisponível.");
      await completeActivationModule(restaurantId, module);
    },
    onSuccess: (_, module) => {
      queryClient.setQueryData<OnboardingGuideProgress>(
        activationProgressQueryKey(restaurantId),
        (progress) => progress ? markGuideModuleComplete(progress, module) : progress,
      );
      void queryClient.invalidateQueries({
        queryKey: activationProgressQueryKey(restaurantId),
      });
    },
  });
}
