import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { vaptApiRequest } from "@/lib/vapt-api-client";
import PublicMenu from "@/pages/menu/PublicMenu";

const { legacyRpc, legacyFrom } = vi.hoisted(() => ({
  legacyRpc: vi.fn(),
  legacyFrom: vi.fn(),
}));

vi.mock("@/lib/vapt-api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vapt-api-client")>();
  return {
    ...actual,
    vaptApiRequest: vi.fn(),
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: legacyRpc,
    from: legacyFrom,
  },
}));

const catalog = {
  restaurant: {
    id: "30000000-0000-4000-8000-000000000001",
    name: "Vapt Bistrô",
    slug: "vapt-bistro",
    whatsapp: null,
    address: null,
    phone: null,
    hours: null,
    description: null,
    primaryColor: "#0ea573",
    secondaryColor: "#1e293b",
    fontFamily: "modern",
    logoUrl: null,
    totalTables: 12,
    maxTables: 20,
    paymentMode: "open_tab",
    maxPendingOrders: 3,
    localEnabled: true,
    deliveryEnabled: true,
    updatedAt: "2026-09-25T12:00:00.000Z",
  },
  items: [{
    id: "10000000-0000-4000-8000-000000000001",
    restaurantId: "30000000-0000-4000-8000-000000000001",
    name: "Prato do dia",
    price: "23.50",
    description: "Arroz, feijão e salada",
    category: "Pratos",
    available: true,
    imageUrl: null,
    availableFrom: null,
    availableUntil: null,
    badge: "Popular",
    isChefSuggestion: true,
    prepTimeMinutes: 15,
    createdAt: "2026-09-25T12:00:00.000Z",
    updatedAt: "2026-09-25T12:00:00.000Z",
    variations: [{ id: "variation-1", name: "Tamanho", options: ["P", "G"], required: true }],
  }],
};

describe("catálogo público do menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vaptApiRequest).mockResolvedValue(catalog);
    legacyRpc.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: catalog.restaurant.id,
          name: catalog.restaurant.name,
          slug: catalog.restaurant.slug,
          logo_url: null,
          primary_color: catalog.restaurant.primaryColor,
          secondary_color: catalog.restaurant.secondaryColor,
          font_family: catalog.restaurant.fontFamily,
          payment_mode: catalog.restaurant.paymentMode,
          max_pending_orders: catalog.restaurant.maxPendingOrders,
          local_enabled: true,
          delivery_enabled: true,
        },
        error: null,
      }),
    });
    legacyFrom.mockImplementation((table: string) => {
      const data = table === "menu_item_variations"
        ? [{ id: "variation-1", menu_item_id: catalog.items[0].id, name: "Tamanho", options: ["P", "G"], required: true }]
        : [{
            id: catalog.items[0].id,
            name: catalog.items[0].name,
            description: catalog.items[0].description,
            price: catalog.items[0].price,
            category: catalog.items[0].category,
            image_url: null,
            available: true,
            available_from: null,
            available_until: null,
            badge: "Popular",
            is_chef_suggestion: true,
            prep_time_minutes: 15,
          }];
      const query: Record<string, unknown> = {
        select: vi.fn(),
        eq: vi.fn(),
        in: vi.fn(),
        then: (resolve: (value: unknown) => void) => resolve({ data, error: null }),
      };
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.in = vi.fn(() => query);
      return query;
    });
  });

  afterEach(() => {
    document.documentElement.removeAttribute("style");
  });

  it("carrega restaurante, itens e variações pela API pública sem Supabase", async () => {
    render(
      <MemoryRouter initialEntries={["/menu/vapt-bistro?table=12"]}>
        <Routes>
          <Route path="/menu/:slug" element={<PublicMenu />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Vapt Bistrô")).toBeInTheDocument();
    expect(screen.getByText("Prato do dia")).toBeInTheDocument();
    await waitFor(() => expect(vaptApiRequest).toHaveBeenCalledWith({
      method: "GET",
      route: "/public/restaurants/vapt-bistro/catalog",
      requireAuth: false,
    }));
    expect(legacyRpc).not.toHaveBeenCalled();
    expect(legacyFrom).not.toHaveBeenCalled();
  });
});
