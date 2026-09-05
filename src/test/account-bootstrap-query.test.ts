import { describe, expect, it } from "vitest";

import {
  deriveAccountBootstrap,
  type AccountBootstrapInput,
} from "@/features/auth/account-bootstrap-query";

const baseInput = (
  overrides: Partial<AccountBootstrapInput> = {},
): AccountBootstrapInput => ({
  userId: "user-1",
  organizations: [],
  restaurants: [],
  preferredOrganizationId: null,
  preferredRestaurantId: null,
  routeRestaurantId: null,
  ...overrides,
});

describe("account bootstrap", () => {
  it("routes to onboarding when the user has no organizations", () => {
    const bootstrap = deriveAccountBootstrap(baseInput());

    expect(bootstrap.destination).toBe("onboarding");
    expect(bootstrap.currentOrganizationId).toBeNull();
    expect(bootstrap.currentRestaurantId).toBeNull();
  });

  it("routes to onboarding when the user has an organization but no restaurants", () => {
    const bootstrap = deriveAccountBootstrap(
      baseInput({
        organizations: [{ id: "org-1", name: "Org 1", role: "owner" }],
      }),
    );

    expect(bootstrap.destination).toBe("onboarding");
    expect(bootstrap.currentOrganizationId).toBe("org-1");
    expect(bootstrap.currentRestaurantId).toBeNull();
  });

  it("uses a stable organization fallback independent of query row order", () => {
    const bootstrap = deriveAccountBootstrap(
      baseInput({
        organizations: [
          { id: "org-z", name: "Z", role: "owner" },
          { id: "org-a", name: "A", role: "admin" },
        ],
      }),
    );

    expect(bootstrap.currentOrganizationId).toBe("org-a");
  });

  it("routes to onboarding and keeps the draft restaurant when onboarding is incomplete", () => {
    const bootstrap = deriveAccountBootstrap(
      baseInput({
        organizations: [{ id: "org-1", name: "Org 1", role: "owner" }],
        restaurants: [
          { id: "rest-1", organizationId: "org-1", name: "Draft", slug: "draft", onboardingStatus: "draft" },
        ],
      }),
    );

    expect(bootstrap.destination).toBe("onboarding");
    expect(bootstrap.currentOrganizationId).toBe("org-1");
    expect(bootstrap.currentRestaurantId).toBe("rest-1");
  });

  it("routes to dashboard when there is exactly one completed restaurant", () => {
    const bootstrap = deriveAccountBootstrap(
      baseInput({
        organizations: [{ id: "org-1", name: "Org 1", role: "owner" }],
        restaurants: [
          { id: "rest-1", organizationId: "org-1", name: "Ready", slug: "ready", onboardingStatus: "complete" },
        ],
      }),
    );

    expect(bootstrap.destination).toBe("dashboard");
    expect(bootstrap.currentOrganizationId).toBe("org-1");
    expect(bootstrap.currentRestaurantId).toBe("rest-1");
  });

  it("uses the route restaurant when it belongs to the user", () => {
    const bootstrap = deriveAccountBootstrap(
      baseInput({
        organizations: [
          { id: "org-1", name: "Org 1", role: "owner" },
          { id: "org-2", name: "Org 2", role: "admin" },
        ],
        restaurants: [
          { id: "rest-1", organizationId: "org-1", name: "Ready A", slug: "ready-a", onboardingStatus: "complete" },
          { id: "rest-2", organizationId: "org-2", name: "Ready B", slug: "ready-b", onboardingStatus: "complete" },
        ],
        routeRestaurantId: "rest-2",
      }),
    );

    expect(bootstrap.destination).toBe("dashboard");
    expect(bootstrap.currentOrganizationId).toBe("org-2");
    expect(bootstrap.currentRestaurantId).toBe("rest-2");
  });

  it("routes to the selector when multiple completed restaurants exist with no valid preference", () => {
    const bootstrap = deriveAccountBootstrap(
      baseInput({
        organizations: [{ id: "org-1", name: "Org 1", role: "owner" }],
        restaurants: [
          { id: "rest-1", organizationId: "org-1", name: "Ready A", slug: "ready-a", onboardingStatus: "complete" },
          { id: "rest-2", organizationId: "org-1", name: "Ready B", slug: "ready-b", onboardingStatus: "complete" },
        ],
      }),
    );

    expect(bootstrap.destination).toBe("select-restaurant");
    expect(bootstrap.currentOrganizationId).toBe("org-1");
    expect(bootstrap.currentRestaurantId).toBeNull();
  });

  it("ignores a stale preferred restaurant and falls back to selector", () => {
    const bootstrap = deriveAccountBootstrap(
      baseInput({
        organizations: [{ id: "org-1", name: "Org 1", role: "owner" }],
        restaurants: [
          { id: "rest-1", organizationId: "org-1", name: "Ready A", slug: "ready-a", onboardingStatus: "complete" },
          { id: "rest-2", organizationId: "org-1", name: "Ready B", slug: "ready-b", onboardingStatus: "complete" },
        ],
        preferredRestaurantId: "rest-missing",
      }),
    );

    expect(bootstrap.destination).toBe("select-restaurant");
    expect(bootstrap.currentRestaurantId).toBeNull();
  });

  it("ignores a cross-organization preferred restaurant mismatch", () => {
    const bootstrap = deriveAccountBootstrap(
      baseInput({
        organizations: [
          { id: "org-1", name: "Org 1", role: "owner" },
          { id: "org-2", name: "Org 2", role: "admin" },
        ],
        restaurants: [
          { id: "rest-1", organizationId: "org-1", name: "Ready A", slug: "ready-a", onboardingStatus: "complete" },
          { id: "rest-2", organizationId: "org-2", name: "Ready B", slug: "ready-b", onboardingStatus: "complete" },
        ],
        preferredOrganizationId: "org-1",
        preferredRestaurantId: "rest-2",
      }),
    );

    expect(bootstrap.destination).toBe("select-restaurant");
    expect(bootstrap.currentOrganizationId).toBe("org-1");
    expect(bootstrap.currentRestaurantId).toBeNull();
  });

  it("uses a valid preferred restaurant when it matches the preferred organization", () => {
    const bootstrap = deriveAccountBootstrap(
      baseInput({
        organizations: [
          { id: "org-1", name: "Org 1", role: "owner" },
          { id: "org-2", name: "Org 2", role: "admin" },
        ],
        restaurants: [
          { id: "rest-1", organizationId: "org-1", name: "Ready A", slug: "ready-a", onboardingStatus: "complete" },
          { id: "rest-2", organizationId: "org-2", name: "Ready B", slug: "ready-b", onboardingStatus: "complete" },
        ],
        preferredOrganizationId: "org-2",
        preferredRestaurantId: "rest-2",
      }),
    );

    expect(bootstrap.destination).toBe("dashboard");
    expect(bootstrap.currentOrganizationId).toBe("org-2");
    expect(bootstrap.currentRestaurantId).toBe("rest-2");
  });

  it("exposes only restaurants from the organizations in the active membership subset", () => {
    const bootstrap = deriveAccountBootstrap(
      baseInput({
        organizations: [{ id: "org-2", name: "Org 2", role: "staff" }],
        restaurants: [
          { id: "rest-2", organizationId: "org-2", name: "Allowed", slug: "allowed", onboardingStatus: "complete" },
        ],
        preferredOrganizationId: "org-1",
        preferredRestaurantId: "rest-1",
      }),
    );

    expect(bootstrap.destination).toBe("dashboard");
    expect(bootstrap.currentOrganizationId).toBe("org-2");
    expect(bootstrap.currentRestaurantId).toBe("rest-2");
    expect(bootstrap.restaurants.map((restaurant) => restaurant.id)).toEqual(["rest-2"]);
  });

  it("does not let a draft in another organization override a valid completed preference", () => {
    const bootstrap = deriveAccountBootstrap(
      baseInput({
        organizations: [
          { id: "org-1", name: "Org 1", role: "owner" },
          { id: "org-2", name: "Org 2", role: "admin" },
        ],
        restaurants: [
          { id: "rest-1", organizationId: "org-1", name: "Ready", slug: "ready", onboardingStatus: "complete" },
          { id: "rest-2", organizationId: "org-2", name: "Draft", slug: "draft", onboardingStatus: "draft" },
        ],
        preferredOrganizationId: "org-1",
        preferredRestaurantId: "rest-1",
      }),
    );

    expect(bootstrap.destination).toBe("dashboard");
    expect(bootstrap.currentOrganizationId).toBe("org-1");
    expect(bootstrap.currentRestaurantId).toBe("rest-1");
  });
});
