import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const menuImageMocks = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  persistMenuItemImage: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/features/restaurants/current-restaurant", () => ({
  useCurrentRestaurant: () => ({
    restaurantId: "rest-1",
    restaurant: {
      id: "rest-1",
      organizationId: "org-1",
      name: "Vapt Burger",
      slug: "vapt-burger",
      onboardingStatus: "complete",
    },
    isLoading: false,
  }),
}));

vi.mock("@/features/restaurants/restaurant-assets", () => ({
  persistMenuItemImage: menuImageMocks.persistMenuItemImage,
  removePersistedRestaurantAsset: vi.fn(),
  validateRestaurantImage: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: menuImageMocks.toast }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: menuImageMocks.from,
    storage: { from: vi.fn() },
  },
}));

import MenuManagement from "@/pages/dashboard/MenuManagement";

describe("menu item image upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    class ImageMock {
      width = 100;
      height = 100;
      onload: null | (() => void) = null;
      onerror: null | ((error: unknown) => void) = null;
      private source = "";

      set src(value: string) {
        this.source = value;
        queueMicrotask(() => this.onload?.());
      }

      get src() {
        return this.source;
      }
    }
    vi.stubGlobal("Image", ImageMock);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:dish-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    menuImageMocks.persistMenuItemImage.mockRejectedValue(new Error("storage unavailable"));
    menuImageMocks.insert.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { id: "item-1" }, error: null }),
      })),
    });
    menuImageMocks.from.mockImplementation((table: string) => {
      if (table === "menu_items") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
          insert: menuImageMocks.insert,
          update: vi.fn(),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("does not create a product row when its image upload fails", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MenuManagement />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("0 itens cadastrados")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Item" }));
    fireEvent.change(screen.getByPlaceholderText("Ex: X-Burguer"), {
      target: { value: "X-Burguer" },
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "29.90" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Ex: Hamb/i), {
      target: { value: "Lanches" },
    });

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(["dish"], "dish.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(menuImageMocks.persistMenuItemImage).toHaveBeenCalledTimes(1));
    expect(menuImageMocks.insert).not.toHaveBeenCalled();
    expect(menuImageMocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Erro ao salvar",
      variant: "destructive",
    }));
  });
});
