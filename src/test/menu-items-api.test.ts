import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MenuItemDto } from "@/lib/business-api.types";
import {
  createMenuItem,
  deleteMenuItem,
  listOwnedMenuItems,
  updateMenuItem,
} from "@/lib/menu-items";
import { vaptApiRequest } from "@/lib/vapt-api-client";

vi.mock("@/lib/vapt-api-client", () => ({ vaptApiRequest: vi.fn() }));

const mockedRequest = vi.mocked(vaptApiRequest);
const item = { id: "item-1" } as MenuItemDto;

describe("menu item API client", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
    mockedRequest.mockResolvedValue(item);
  });

  it("uses the owner-scoped collection routes", async () => {
    mockedRequest.mockResolvedValueOnce([item]);
    await listOwnedMenuItems();
    await createMenuItem({
      name: "X-Burger",
      price: "29.90",
      description: null,
      category: "Lanches",
      available: true,
      imageUrl: null,
      availableFrom: null,
      availableUntil: null,
      badge: null,
      isChefSuggestion: false,
      prepTimeMinutes: null,
      variations: [],
    });

    expect(mockedRequest).toHaveBeenNthCalledWith(1, {
      method: "GET",
      route: "/restaurants/me/menu-items",
    });
    expect(mockedRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: "POST",
      route: "/restaurants/me/menu-items",
    }));
  });

  it("encodes item ids for patch and delete", async () => {
    await updateMenuItem("item/with slash", { available: false });
    await deleteMenuItem("item/with slash");

    expect(mockedRequest).toHaveBeenNthCalledWith(1, {
      method: "PATCH",
      route: "/restaurants/me/menu-items/item%2Fwith%20slash",
      body: { available: false },
    });
    expect(mockedRequest).toHaveBeenNthCalledWith(2, {
      method: "DELETE",
      route: "/restaurants/me/menu-items/item%2Fwith%20slash",
    });
  });
});
