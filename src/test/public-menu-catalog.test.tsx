import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { vaptApiRequest } from "@/lib/vapt-api-client";
import PublicMenu from "@/pages/menu/PublicMenu";

vi.mock("@/lib/vapt-api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vapt-api-client")>();
  return {
    ...actual,
    vaptApiRequest: vi.fn(),
  };
});

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
  });
});
