import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const { loadStripeMock } = vi.hoisted(() => ({ loadStripeMock: vi.fn() }));

vi.mock("@stripe/stripe-js", () => ({ loadStripe: loadStripeMock }));
vi.mock("@/lib/env", () => ({
  ENV: {
    stripeConfigured: false,
    stripePublishableKey: "",
  },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "owner@example.com" } }),
}));
vi.mock("@/features/auth/use-account-bootstrap", () => ({
  useAccountBootstrap: () => ({ data: { currentOrganizationId: "org-1" } }),
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({ restaurantId: "rest-1", planStatus: "trialing" }),
}));
vi.mock("@/lib/n8n-client", () => ({
  n8nClient: { stripe: {} },
  N8nClientError: class extends Error {},
}));

import StripeCheckoutModal from "@/components/dashboard/StripeCheckoutModal";

it("shows Stripe as unavailable without initializing the SDK", () => {
  render(
    <StripeCheckoutModal
      open
      onOpenChange={() => undefined}
      plan={{
        id: "starter",
        name: "Starter",
        price: 97,
        priceId: "",
        features: [],
        blockedFeatures: [],
        highlighted: false,
        maxRestaurants: 1,
      }}
    />,
  );

  expect(screen.getByText(/assinaturas temporariamente indisponíveis/i)).toBeInTheDocument();
  expect(loadStripeMock).not.toHaveBeenCalled();
});
