import type { RestaurantDto } from "@/lib/business-api.types";
import { VaptApiClientError, vaptApiRequest } from "@/lib/vapt-api-client";
import type { CatalogMutationExecutor } from "@/lib/catalog-mutations";

export type OnboardingInput = {
  restaurantName: string;
  slug: string;
  dishName: string;
  dishPrice: string;
};

export type OwnedRestaurantPatch = Partial<Pick<
  RestaurantDto,
  | "name"
  | "slug"
  | "cnpj"
  | "whatsapp"
  | "address"
  | "phone"
  | "hours"
  | "description"
  | "primaryColor"
  | "secondaryColor"
  | "fontFamily"
  | "logoUrl"
  | "totalTables"
  | "maxTables"
  | "paymentMode"
  | "maxPendingOrders"
  | "localEnabled"
  | "deliveryEnabled"
>>;

export async function fetchOwnedRestaurant(): Promise<RestaurantDto | null> {
  try {
    return await vaptApiRequest<RestaurantDto>({
      method: "GET",
      route: "/restaurants/me",
    });
  } catch (error) {
    if (error instanceof VaptApiClientError && error.status === 404) return null;
    throw error;
  }
}

export function createOnboarding(input: OnboardingInput, publication?: CatalogMutationExecutor): Promise<RestaurantDto> {
  if (publication) return publication.run<RestaurantDto>({ method: "POST", route: "/onboarding", body: input }, reloadOwnedRestaurant);
  return vaptApiRequest<RestaurantDto>({
    method: "POST",
    route: "/onboarding",
    body: input,
  });
}

export function updateOwnedRestaurant(patch: OwnedRestaurantPatch, publication?: CatalogMutationExecutor): Promise<RestaurantDto> {
  if (publication) return publication.run<RestaurantDto>({ method: "PATCH", route: "/restaurants/me", body: patch }, reloadOwnedRestaurant);
  return vaptApiRequest<RestaurantDto>({
    method: "PATCH",
    route: "/restaurants/me",
    body: patch,
  });
}

async function reloadOwnedRestaurant(): Promise<RestaurantDto> {
  const restaurant = await fetchOwnedRestaurant();
  if (!restaurant) throw new VaptApiClientError("catalog_result_unavailable", "Alteração publicada, mas não foi possível recarregar o restaurante.", 503);
  return restaurant;
}
