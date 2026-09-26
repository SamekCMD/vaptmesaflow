import type { RestaurantDto } from "@/lib/business-api.types";
import { VaptApiClientError, vaptApiRequest } from "@/lib/vapt-api-client";

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

export function createOnboarding(input: OnboardingInput): Promise<RestaurantDto> {
  return vaptApiRequest<RestaurantDto>({
    method: "POST",
    route: "/onboarding",
    body: input,
  });
}

export function updateOwnedRestaurant(patch: OwnedRestaurantPatch): Promise<RestaurantDto> {
  return vaptApiRequest<RestaurantDto>({
    method: "PATCH",
    route: "/restaurants/me",
    body: patch,
  });
}
