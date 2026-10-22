import type { RestaurantDto } from "@/lib/business-api.types";
import { VaptApiClientError, vaptApiRequest } from "@/lib/vapt-api-client";
import type { CatalogMutationExecutor } from "@/lib/catalog-mutations";
import {z} from 'zod';
export function restaurantRoute(restaurantId:string):string{
  const parsed=z.string().uuid().safeParse(restaurantId);
  if(!parsed.success)throw new VaptApiClientError('invalid_restaurant_scope','Selecione um restaurante válido.',400);
  return `/restaurants/${parsed.data.toLowerCase()}`;
}
export async function checkRestaurantSlug(restaurantId:string,slug:string,signal?:AbortSignal):Promise<boolean>{
  const value=z.string().trim().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).parse(slug);
  const raw=await vaptApiRequest<unknown>({method:'GET',route:restaurantRoute(restaurantId)+'/slug-availability',query:{slug:value},requireAuth:true,...(signal?{signal}:{})});
  const parsed=z.object({available:z.boolean()}).strict().safeParse(raw);
  if(!parsed.success)throw new VaptApiClientError('invalid_slug_response','Não foi possível verificar o endereço.',502);return parsed.data.available;
}
export async function fetchRestaurant(restaurantId:string,signal?:AbortSignal):Promise<RestaurantDto>{
  const route=restaurantRoute(restaurantId);
  const result=await vaptApiRequest<RestaurantDto>({method:'GET',route,...(signal?{signal}:{})});
  if(result.id!==restaurantId.toLowerCase())throw new VaptApiClientError('invalid_restaurant_response','Não foi possível confirmar o restaurante.',502);
  return result;
}
export function updateRestaurant(restaurantId:string,patch:OwnedRestaurantPatch,publication?:CatalogMutationExecutor):Promise<RestaurantDto>{
  const route=restaurantRoute(restaurantId);
  if(publication)return publication.run<RestaurantDto>({method:'PATCH',route,body:patch},()=>fetchRestaurant(restaurantId));
  return vaptApiRequest<RestaurantDto>({method:'PATCH',route,body:patch});
}

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
