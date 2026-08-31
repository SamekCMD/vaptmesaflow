import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSubscription } from "@/hooks/useSubscription";

const authState = vi.hoisted(() => ({
  user: { id: "user-a" },
}));

const bootstrapState = vi.hoisted(() => ({
  data: {
    currentOrganizationId: "org-a",
    currentRestaurantId: "restaurant-a",
  },
  isLoading: false,
}));

const dataSources = vi.hoisted(() => ({
  fetchLegacyRestaurant: vi.fn(),
  fetchOrganizationSubscription: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/features/auth/use-account-bootstrap", () => ({
  useAccountBootstrap: () => bootstrapState,
}));

vi.mock("@/lib/restaurants", () => ({
  fetchOwnedRestaurant: (...args: unknown[]) => dataSources.fetchLegacyRestaurant(...args),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (_column: string, organizationId: string) => ({
          maybeSingle: () => dataSources.fetchOrganizationSubscription(organizationId),
        }),
      }),
    }),
  },
}));

describe("useSubscription", () => {
  beforeEach(() => {
    authState.user = { id: "user-a" };
    bootstrapState.data = {
      currentOrganizationId: "org-a",
      currentRestaurantId: "restaurant-a",
    };
    dataSources.fetchLegacyRestaurant.mockReset();
    dataSources.fetchOrganizationSubscription.mockReset();
  });

  it("does not expose user A subscription while user B subscription is loading", async () => {
    const pendingUserB = new Promise(() => {});

    dataSources.fetchLegacyRestaurant.mockImplementation((userId: string) => {
      if (userId === "user-a") {
        return Promise.resolve({
          id: "restaurant-a",
          plan_type: "business",
          plan_status: "active",
          trial_ends_at: null,
        });
      }
      return pendingUserB;
    });
    dataSources.fetchOrganizationSubscription.mockImplementation((organizationId: string) => {
      if (organizationId === "org-a") {
        return Promise.resolve({
          data: {
            organization_id: "org-a",
            plan_type: "business",
            plan_status: "active",
            trial_ends_at: null,
          },
          error: null,
        });
      }
      return pendingUserB;
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.planType).toBe("business"));

    authState.user = { id: "user-b" };
    bootstrapState.data = {
      currentOrganizationId: "org-b",
      currentRestaurantId: "restaurant-b",
    };
    rerender();

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.planType).toBe("trial");
    expect(result.current.restaurantId).toBe("restaurant-b");
  });
});
