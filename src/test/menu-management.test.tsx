import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MenuItemDto, RestaurantDto } from "@/lib/business-api.types";
import {
  createMenuItem,
  deleteMenuItem,
  listOwnedMenuItems,
  updateMenuItem,
} from "@/lib/menu-items";
import MenuManagement from "@/pages/dashboard/MenuManagement";

const { authUser } = vi.hoisted(() => ({ authUser: { id: "owner-1" } }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock("@/lib/restaurants", () => ({
  fetchOwnedRestaurant: vi.fn(),
}));

vi.mock("@/lib/menu-items", () => ({
  listOwnedMenuItems: vi.fn(),
  createMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  deleteMenuItem: vi.fn(),
}));

vi.mock("@/lib/menu-image-storage", () => ({
  uploadMenuImage: vi.fn(),
  deleteMenuImage: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

import { fetchOwnedRestaurant } from "@/lib/restaurants";

const restaurant = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Vapt Burger",
} as RestaurantDto;

const existingItem: MenuItemDto = {
  id: "30000000-0000-4000-8000-000000000001",
  restaurantId: restaurant.id,
  name: "X-Salada",
  price: "24.90",
  description: null,
  category: "Hambúrgueres",
  available: true,
  imageUrl: null,
  availableFrom: null,
  availableUntil: null,
  badge: null,
  isChefSuggestion: false,
  prepTimeMinutes: 12,
  createdAt: "2026-09-26T12:00:00.000Z",
  updatedAt: "2026-09-26T12:00:00.000Z",
  variations: [],
};

describe("menu management API cutover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchOwnedRestaurant).mockResolvedValue(restaurant);
    vi.mocked(listOwnedMenuItems).mockResolvedValue([existingItem]);
    vi.mocked(createMenuItem).mockImplementation(async (input) => ({
      ...existingItem,
      id: "30000000-0000-4000-8000-000000000002",
      name: input.name,
      price: input.price,
      category: input.category,
      prepTimeMinutes: input.prepTimeMinutes,
    }));
    vi.mocked(updateMenuItem).mockResolvedValue(existingItem);
    vi.mocked(deleteMenuItem).mockResolvedValue(undefined);
  });

  it("loads the owner-scoped menu without Supabase selects", async () => {
    render(<MemoryRouter><MenuManagement /></MemoryRouter>);

    expect(await screen.findByText("X-Salada")).toBeInTheDocument();
    expect(listOwnedMenuItems).toHaveBeenCalledWith();
    expect(fetchOwnedRestaurant).toHaveBeenCalledWith();
  });

  it("creates an item through the camelCase API contract and renders the server response", async () => {
    render(<MemoryRouter><MenuManagement /></MemoryRouter>);
    await screen.findByText("X-Salada");

    fireEvent.click(screen.getByRole("button", { name: "Adicionar Item" }));
    fireEvent.change(screen.getByPlaceholderText("Ex: X-Burguer"), {
      target: { value: "X-Bacon" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "31.50" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex: Hambúrgueres"), {
      target: { value: "Especiais" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex: 15"), {
      target: { value: "18" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(createMenuItem).toHaveBeenCalledWith({
      name: "X-Bacon",
      price: "31.50",
      description: null,
      category: "Especiais",
      available: true,
      imageUrl: null,
      availableFrom: null,
      availableUntil: null,
      badge: null,
      isChefSuggestion: false,
      prepTimeMinutes: 18,
      variations: [],
    }));
    expect(await screen.findByText("X-Bacon")).toBeInTheDocument();
  });

  it("deletes through the owner-scoped API before removing the row", async () => {
    render(<MemoryRouter><MenuManagement /></MemoryRouter>);
    await screen.findByText("X-Salada");

    fireEvent.click(screen.getByRole("button", { name: "Remover X-Salada" }));

    await waitFor(() => expect(deleteMenuItem).toHaveBeenCalledWith(existingItem.id));
    expect(screen.queryByText("X-Salada")).not.toBeInTheDocument();
  });
});
