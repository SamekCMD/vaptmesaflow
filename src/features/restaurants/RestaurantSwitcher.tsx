import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AccountBootstrap } from "@/features/auth/account-bootstrap-query";
import type { RestaurantCreationEntitlement } from "./restaurant-entitlement";

type RestaurantSwitcherProps = {
  bootstrap: AccountBootstrap;
  entitlement?: RestaurantCreationEntitlement;
  onSwitch: (restaurantId: string) => Promise<unknown>;
};

export function RestaurantSwitcher({ bootstrap, entitlement, onSwitch }: RestaurantSwitcherProps) {
  const restaurants = bootstrap.restaurants.filter(
    (restaurant) => restaurant.onboardingStatus === "complete",
  );
  const currentRestaurant = restaurants.find(
    (restaurant) => restaurant.id === bootstrap.currentRestaurantId,
  );
  const canManageRestaurants = entitlement?.role === "owner" || entitlement?.role === "admin";

  if (!currentRestaurant || (restaurants.length <= 1 && !canManageRestaurants)) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 max-w-[220px] justify-between gap-2 px-2.5 text-left"
          aria-label={`Restaurante atual: ${currentRestaurant.name}`}
        >
          <span className="truncate text-sm font-medium">{currentRestaurant.name}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Trocar restaurante
        </DropdownMenuLabel>
        {restaurants.map((restaurant) => {
          const organization = bootstrap.organizations.find(
            (candidate) => candidate.id === restaurant.organizationId,
          );
          const selected = restaurant.id === currentRestaurant.id;

          return (
            <DropdownMenuItem
              key={restaurant.id}
              className="min-h-11 justify-between gap-3"
              disabled={selected}
              onSelect={() => void onSwitch(restaurant.id)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm">{restaurant.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {organization?.name ?? `/${restaurant.slug}`}
                </span>
              </span>
              {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
        {canManageRestaurants ? <DropdownMenuSeparator /> : null}
        {entitlement?.canCreate ? (
          <DropdownMenuItem asChild className="min-h-11">
            <Link to={`/restaurants/new?organizationId=${encodeURIComponent(currentRestaurant.organizationId)}`}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar restaurante
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canManageRestaurants && entitlement?.reason === "plan_limit" ? (
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Limite de {entitlement.maxRestaurants} restaurante{entitlement.maxRestaurants === 1 ? "" : "s"} atingido
          </DropdownMenuLabel>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
