import type {
  AccountBootstrap,
  AccountBootstrapRestaurant,
} from "@/features/auth/account-bootstrap-query";
import { useAccountBootstrap } from "@/features/auth/use-account-bootstrap";

export function resolveCurrentRestaurant(
  bootstrap: AccountBootstrap | null | undefined,
): AccountBootstrapRestaurant | null {
  if (!bootstrap?.currentRestaurantId) return null;

  return (
    bootstrap.restaurants.find(
      (restaurant) => restaurant.id === bootstrap.currentRestaurantId,
    ) ?? null
  );
}

export function useCurrentRestaurant() {
  const bootstrapQuery = useAccountBootstrap();
  const restaurant = resolveCurrentRestaurant(bootstrapQuery.data);

  return {
    restaurant,
    restaurantId: restaurant?.id ?? null,
    isLoading: bootstrapQuery.isLoading,
  };
}
