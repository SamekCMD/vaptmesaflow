import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppearancePage from "@/pages/dashboard/AppearancePage";
import { fetchOwnedRestaurant, updateOwnedRestaurant } from "@/lib/restaurants";

const { authUser } = vi.hoisted(() => ({ authUser: { id: "owner-1" } }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock("@/lib/restaurants", () => ({
  fetchOwnedRestaurant: vi.fn(),
  updateOwnedRestaurant: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const mockedFetch = vi.mocked(fetchOwnedRestaurant);
const mockedUpdate = vi.mocked(updateOwnedRestaurant);

describe("appearance restaurant API", () => {
  it("loads and saves the authenticated owner's camelCase restaurant", async () => {
    mockedFetch.mockResolvedValue({
      id: "restaurant-1",
      name: "Vapt Bistrô",
      slug: "vapt-bistro",
      cnpj: null,
      whatsapp: null,
      address: null,
      phone: null,
      hours: null,
      description: null,
      primaryColor: "#0ea573",
      secondaryColor: "#1e293b",
      fontFamily: "modern",
      logoUrl: null,
      planType: "starter",
      planStatus: "trialing",
      trialEndsAt: "2026-09-29T12:00:00.000Z",
      totalTables: 1,
      maxTables: 1,
      paymentMode: "open_tab",
      maxPendingOrders: 3,
      localEnabled: true,
      deliveryEnabled: true,
      onboardingCompleted: true,
      updatedAt: "2026-09-26T12:00:00.000Z",
    });
    mockedUpdate.mockResolvedValue({ id: "restaurant-1" } as never);

    render(<AppearancePage />);

    const nameInput = await screen.findByDisplayValue("Vapt Bistrô");
    expect(mockedFetch).toHaveBeenCalledWith();
    fireEvent.change(nameInput, { target: { value: "Vapt Novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alteracoes" }));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith({
      name: "Vapt Novo",
      slug: "vapt-bistro",
      primaryColor: "#0ea573",
      secondaryColor: "#1e293b",
      fontFamily: "modern",
      logoUrl: null,
    }));
  });
});
