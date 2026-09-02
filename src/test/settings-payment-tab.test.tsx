import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "@/pages/dashboard/SettingsPage";

const restaurantRow = vi.hoisted(() => ({
  id: "10000000-0000-4000-8000-000000000001",
  cnpj: null,
  name: "Restaurante Teste",
  address: "Rua Teste, 1",
  phone: "61999999999",
  hours: "18h as 23h",
  description: "Restaurante de teste",
  payment_mode: "prepaid",
  max_pending_orders: 3,
  max_tables: 20,
  local_enabled: true,
  delivery_enabled: true,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "20000000-0000-4000-8000-000000000001",
      email: "gestor@vapt.test",
      user_metadata: { full_name: "Gestor Vapt" },
    },
  }),
}));

vi.mock("@/features/restaurants/current-restaurant", () => ({
  useCurrentRestaurant: () => ({
    restaurantId: "10000000-0000-4000-8000-000000000001",
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: restaurantRow, error: null }),
        }),
      }),
    })),
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

describe("aba de pagamentos nas configuracoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("separa pagamentos e mantem as tres abas acessiveis no mobile", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const restaurantTab = await screen.findByRole("tab", { name: "Restaurante" });
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
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard/settings?tab=payments"]}>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Meios atuais de teste")).toBeInTheDocument();
    expect(screen.getByText("Mercado Pago de teste")).toBeInTheDocument();
    expect(screen.queryByText("Canais Ativos")).not.toBeInTheDocument();
  });
});
