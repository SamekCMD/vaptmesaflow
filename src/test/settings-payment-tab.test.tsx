import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "@/pages/dashboard/SettingsPage";
import { fetchOwnedRestaurant, updateOwnedRestaurant } from "@/lib/restaurants";

const { authUser } = vi.hoisted(() => ({
  authUser: {
    id: "20000000-0000-4000-8000-000000000001",
    email: "gestor@vapt.test",
    user_metadata: { full_name: "Gestor Vapt" },
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authUser,
  }),
}));

vi.mock("@/lib/restaurants", () => ({
  fetchOwnedRestaurant: vi.fn(),
  updateOwnedRestaurant: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { updateUser: vi.fn() },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/components/payments/CurrentPaymentMethodsCard", () => ({
  default: () => <div>Meios atuais de teste</div>,
}));

vi.mock("@/components/payments/MercadoPagoSettingsCard", () => ({
  default: () => <div>Mercado Pago de teste</div>,
}));

const mockedFetchOwnedRestaurant = vi.mocked(fetchOwnedRestaurant);
const mockedUpdateOwnedRestaurant = vi.mocked(updateOwnedRestaurant);

describe("aba de pagamentos nas configuracoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchOwnedRestaurant.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      updatedAt: "2026-08-29T12:00:00.000Z",
      cnpj: null,
      name: "Restaurante Teste",
      slug: "restaurante-teste",
      whatsapp: null,
      address: "Rua Teste, 1",
      phone: "61999999999",
      hours: "18h as 23h",
      description: "Restaurante de teste",
      primaryColor: "#0ea573",
      secondaryColor: "#1e293b",
      fontFamily: "modern",
      logoUrl: null,
      planType: "starter",
      planStatus: "trialing",
      trialEndsAt: "2026-09-29T12:00:00.000Z",
      totalTables: 1,
      maxTables: 20,
      paymentMode: "prepaid",
      maxPendingOrders: 3,
      localEnabled: true,
      deliveryEnabled: true,
      onboardingCompleted: true,
    });
    mockedUpdateOwnedRestaurant.mockResolvedValue({ id: "restaurant-1" } as never);
  });

  it("separa pagamentos e mantem as tres abas acessiveis no mobile", async () => {
    const { unmount } = render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    const restaurantTab = await screen.findByRole("tab", { name: "Restaurante" });
    expect(mockedFetchOwnedRestaurant).toHaveBeenCalledWith();
    const paymentsTab = screen.getByRole("tab", { name: "Pagamentos" });
    const accountTab = screen.getByRole("tab", { name: "Conta" });

    expect(screen.getByRole("tablist")).toHaveClass("grid", "grid-cols-3");
    for (const tab of [restaurantTab, paymentsTab, accountTab]) {
      expect(tab).toHaveClass("min-h-11");
    }

    expect(screen.getByText("Canais Ativos")).toBeInTheDocument();
    expect(screen.queryByText("Meios atuais de teste")).not.toBeInTheDocument();
    expect(screen.queryByText("Mercado Pago de teste")).not.toBeInTheDocument();

    unmount();

    render(
      <MemoryRouter initialEntries={["/dashboard/settings?tab=payments"]}>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Meios atuais de teste")).toBeInTheDocument();
    expect(screen.getByText("Mercado Pago de teste")).toBeInTheDocument();
    expect(screen.queryByText("Canais Ativos")).not.toBeInTheDocument();
  });

  it("saves restaurant and payment settings through the owner-scoped API", async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    await screen.findByDisplayValue("Restaurante Teste");
    fireEvent.change(screen.getByDisplayValue("Restaurante Teste"), {
      target: { value: "Novo Restaurante" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Alterações" }));

    await waitFor(() => expect(mockedUpdateOwnedRestaurant).toHaveBeenCalledWith(expect.objectContaining({
      name: "Novo Restaurante",
      address: "Rua Teste, 1",
      maxTables: 20,
      deliveryEnabled: true,
    })));

    fireEvent.click(screen.getByRole("button", { name: "Salvar fluxo do pedido" }));
    await waitFor(() => expect(mockedUpdateOwnedRestaurant).toHaveBeenCalledWith({
      paymentMode: "prepaid",
      maxPendingOrders: 3,
    }));
  });
});
