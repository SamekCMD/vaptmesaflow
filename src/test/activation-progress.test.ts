import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabase } from "@/lib/supabase";
import {
  completeActivationModule,
  fetchActivationProgress,
  mapActivationProgress,
} from "@/features/onboarding/activation-progress-service";
import {
  activationProgressQueryKey,
  useCompleteActivationModule,
} from "@/features/onboarding/use-activation-progress";
import { EMPTY_GUIDE_PROGRESS } from "@/lib/onboarding";

const progressMocks = vi.hoisted(() => ({
  eq: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: progressMocks.select,
      insert: progressMocks.insert,
    })),
  },
}));

describe("restaurant activation progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    progressMocks.select.mockReturnValue({ eq: progressMocks.eq });
  });

  it("rebuilds the guide without carrying progress between restaurants", () => {
    expect(mapActivationProgress([{ module_key: "cashier" }, { module_key: "menu" }])).toEqual({
      cashier: true,
      menu: true,
      kitchen: false,
      settings: false,
      overview: false,
    });
    expect(mapActivationProgress([])).toEqual({
      cashier: false,
      menu: false,
      kitchen: false,
      settings: false,
      overview: false,
    });
  });

  it("loads only the selected restaurant progress", async () => {
    progressMocks.eq.mockResolvedValue({
      data: [{ module_key: "kitchen" }],
      error: null,
    });

    await expect(fetchActivationProgress("restaurant-b")).resolves.toEqual(
      expect.objectContaining({ kitchen: true, cashier: false }),
    );

    expect(supabase.from).toHaveBeenCalledWith("restaurant_activation_progress");
    expect(progressMocks.select).toHaveBeenCalledWith("module_key");
    expect(progressMocks.eq).toHaveBeenCalledWith("restaurant_id", "restaurant-b");
  });

  it("persists completion for the selected restaurant and accepts duplicates", async () => {
    progressMocks.insert.mockResolvedValueOnce({ data: null, error: null });

    await expect(completeActivationModule("restaurant-a", "menu")).resolves.toBeUndefined();
    expect(progressMocks.insert).toHaveBeenCalledWith({
      restaurant_id: "restaurant-a",
      module_key: "menu",
    });

    progressMocks.insert.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    await expect(completeActivationModule("restaurant-a", "menu")).resolves.toBeUndefined();
  });

  it("keeps cache entries isolated by restaurant", () => {
    expect(activationProgressQueryKey("restaurant-a")).not.toEqual(
      activationProgressQueryKey("restaurant-b"),
    );
  });

  it("updates only the completed restaurant cache", async () => {
    progressMocks.insert.mockResolvedValue({ data: null, error: null });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(activationProgressQueryKey("restaurant-a"), EMPTY_GUIDE_PROGRESS);
    queryClient.setQueryData(activationProgressQueryKey("restaurant-b"), EMPTY_GUIDE_PROGRESS);
    const wrapper = ({ children }: { children: ReactNode }) => createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
    const { result } = renderHook(
      () => useCompleteActivationModule("restaurant-a"),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync("menu");
    });

    expect(queryClient.getQueryData(activationProgressQueryKey("restaurant-a"))).toEqual({
      ...EMPTY_GUIDE_PROGRESS,
      menu: true,
    });
    expect(queryClient.getQueryData(activationProgressQueryKey("restaurant-b"))).toEqual(
      EMPTY_GUIDE_PROGRESS,
    );
  });
});
