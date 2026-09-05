export type MembershipRole = "owner" | "admin" | "manager" | "staff";
export type OnboardingStatus = "draft" | "complete";
export type AccountBootstrapDestination = "onboarding" | "select-restaurant" | "dashboard";

export type AccountBootstrapOrganization = {
  id: string;
  name: string;
  role: MembershipRole;
};

export type AccountBootstrapRestaurant = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  onboardingStatus: OnboardingStatus;
};

export type AccountBootstrap = {
  userId: string;
  organizations: AccountBootstrapOrganization[];
  currentOrganizationId: string | null;
  restaurants: AccountBootstrapRestaurant[];
  currentRestaurantId: string | null;
  destination: AccountBootstrapDestination;
};

export type AccountBootstrapInput = {
  userId: string;
  organizations: AccountBootstrapOrganization[];
  restaurants: AccountBootstrapRestaurant[];
  preferredOrganizationId: string | null;
  preferredRestaurantId: string | null;
  routeRestaurantId: string | null;
};

const isCompletedRestaurant = (restaurant: AccountBootstrapRestaurant) =>
  restaurant.onboardingStatus === "complete";

const isDraftRestaurant = (restaurant: AccountBootstrapRestaurant) =>
  restaurant.onboardingStatus === "draft";

const pickDefaultOrganizationId = (
  organizations: AccountBootstrapOrganization[],
  restaurants: AccountBootstrapRestaurant[],
): string | null => {
  if (organizations.length === 0) return null;

  if (restaurants.length === 1) {
    return restaurants[0].organizationId;
  }

  return organizations[0]?.id ?? null;
};

export function deriveAccountBootstrap(input: AccountBootstrapInput): AccountBootstrap {
  const organizations = [...input.organizations].sort((left, right) => left.id.localeCompare(right.id));
  const restaurants = [...input.restaurants].sort((left, right) => left.id.localeCompare(right.id));
  const routeRestaurant = input.routeRestaurantId
    ? restaurants.find((restaurant) => restaurant.id === input.routeRestaurantId) ?? null
    : null;

  const completedRestaurants = restaurants.filter(isCompletedRestaurant);
  const draftRestaurants = restaurants.filter(isDraftRestaurant);

  if (routeRestaurant) {
    return {
      userId: input.userId,
      organizations,
      currentOrganizationId: routeRestaurant.organizationId,
      restaurants,
      currentRestaurantId: routeRestaurant.id,
      destination: routeRestaurant.onboardingStatus === "draft" ? "onboarding" : "dashboard",
    };
  }

  if (organizations.length === 0) {
    return {
      userId: input.userId,
      organizations,
      currentOrganizationId: null,
      restaurants,
      currentRestaurantId: null,
      destination: "onboarding",
    };
  }

  if (restaurants.length === 0) {
    return {
      userId: input.userId,
      organizations,
      currentOrganizationId:
        input.preferredOrganizationId && organizations.some((organization) => organization.id === input.preferredOrganizationId)
          ? input.preferredOrganizationId
          : organizations[0].id,
      restaurants,
      currentRestaurantId: null,
      destination: "onboarding",
    };
  }

  const preferredOrganizationIsValid =
    input.preferredOrganizationId !== null &&
    organizations.some((organization) => organization.id === input.preferredOrganizationId);

  const preferredRestaurant = input.preferredRestaurantId
    ? completedRestaurants.find((restaurant) => restaurant.id === input.preferredRestaurantId) ?? null
    : null;

  const preferredRestaurantMatchesOrganization =
    preferredRestaurant !== null &&
    (!preferredOrganizationIsValid || preferredRestaurant.organizationId === input.preferredOrganizationId);

  if (preferredRestaurant && preferredRestaurantMatchesOrganization) {
    return {
      userId: input.userId,
      organizations,
      currentOrganizationId: preferredRestaurant.organizationId,
      restaurants,
      currentRestaurantId: preferredRestaurant.id,
      destination: "dashboard",
    };
  }

  if (draftRestaurants.length > 0) {
    const preferredDraft = input.preferredRestaurantId
      ? draftRestaurants.find((restaurant) => restaurant.id === input.preferredRestaurantId) ?? null
      : null;
    const draftRestaurant = preferredDraft ?? draftRestaurants[0];

    return {
      userId: input.userId,
      organizations,
      currentOrganizationId: draftRestaurant.organizationId,
      restaurants,
      currentRestaurantId: draftRestaurant.id,
      destination: "onboarding",
    };
  }

  if (completedRestaurants.length === 1) {
    return {
      userId: input.userId,
      organizations,
      currentOrganizationId: completedRestaurants[0].organizationId,
      restaurants,
      currentRestaurantId: completedRestaurants[0].id,
      destination: "dashboard",
    };
  }

  return {
    userId: input.userId,
    organizations,
    currentOrganizationId: preferredOrganizationIsValid
      ? input.preferredOrganizationId
      : pickDefaultOrganizationId(organizations, completedRestaurants),
    restaurants,
    currentRestaurantId: null,
    destination: "select-restaurant",
  };
}
