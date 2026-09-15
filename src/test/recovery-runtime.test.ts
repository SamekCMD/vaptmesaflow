import { afterEach, describe, expect, it, vi } from "vitest";

const restoreStripeTestEnvironment = () => {
  vi.stubEnv("VITE_LEGACY_STRIPE_ENABLED", "false");
  vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", "pk_test_vapt");
  vi.stubEnv("VITE_STRIPE_PRICE_STARTER", "price_test_starter");
  vi.stubEnv("VITE_STRIPE_PRICE_PRO", "price_test_pro");
  vi.stubEnv("VITE_STRIPE_PRICE_BUSINESS", "price_test_business");
};

afterEach(() => {
  restoreStripeTestEnvironment();
  vi.resetModules();
});

describe("recovery runtime configuration", () => {
  it("starts without Stripe environment variables", async () => {
    vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_STRIPE_PRICE_STARTER", "");
    vi.stubEnv("VITE_STRIPE_PRICE_PRO", "");
    vi.stubEnv("VITE_STRIPE_PRICE_BUSINESS", "");
    vi.resetModules();

    const { ENV } = await import("@/lib/env");

    expect(ENV.stripeConfigured).toBe(false);
    expect(ENV.stripePublishableKey).toBe("");
  });

  it("keeps legacy Stripe disabled even when stale credentials remain", async () => {
    vi.stubEnv("VITE_LEGACY_STRIPE_ENABLED", "false");
    vi.resetModules();

    const { ENV } = await import("@/lib/env");

    expect(ENV.stripeConfigured).toBe(false);
  });
});
