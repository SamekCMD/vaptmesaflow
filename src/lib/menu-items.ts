import type { MenuItemDto, MenuVariationDto } from "@/lib/business-api.types";
import { vaptApiRequest } from "@/lib/vapt-api-client";

export type MenuVariationInput = Omit<MenuVariationDto, "id">;

export type MenuItemInput = {
  name: string;
  price: string;
  description: string | null;
  category: string;
  available: boolean;
  imageUrl: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
  badge: "destaque" | "promocao" | "novo" | null;
  isChefSuggestion: boolean;
  prepTimeMinutes: number | null;
  variations: MenuVariationInput[];
};

export type MenuItemPatch = Partial<MenuItemInput>;

export function listOwnedMenuItems(): Promise<MenuItemDto[]> {
  return vaptApiRequest<MenuItemDto[]>({
    method: "GET",
    route: "/restaurants/me/menu-items",
  });
}

export function createMenuItem(input: MenuItemInput): Promise<MenuItemDto> {
  return vaptApiRequest<MenuItemDto>({
    method: "POST",
    route: "/restaurants/me/menu-items",
    body: input,
  });
}

export function updateMenuItem(itemId: string, patch: MenuItemPatch): Promise<MenuItemDto> {
  return vaptApiRequest<MenuItemDto>({
    method: "PATCH",
    route: `/restaurants/me/menu-items/${encodeURIComponent(itemId)}`,
    body: patch,
  });
}

export function deleteMenuItem(itemId: string): Promise<void> {
  return vaptApiRequest<void>({
    method: "DELETE",
    route: `/restaurants/me/menu-items/${encodeURIComponent(itemId)}`,
  });
}
