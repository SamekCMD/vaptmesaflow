import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { orderClient } from "@/lib/order-client";
import { paymentClient, savePendingCheckout } from "@/lib/payment-client";
import PublicDelivery from "@/pages/delivery/PublicDelivery";

const restaurant = {
  id: "30000000-0000-4000-8000-000000000001",
  name: "Restaurante Teste",
  slug: "restaurante-teste",
  logo_url: null,
  primary_color: "#0ea573",
  secondary_color: "#e8f5ef",
  font_family: "modern",
  delivery_enabled: true,
};

const menuItem = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Prato Teste",
  description: "Descricao",
  price: 23,
  category: "Pratos",
  image_url: null,
  available: true,
};

const maybeSingle = vi.fn().mockResolvedValue({ data: restaurant, error: null });
const menuQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  then: (resolve: (value: unknown) => void) => resolve({ data: [menuItem], error: null }),
};
menuQuery.select.mockReturnValue(menuQuery);
menuQuery.eq.mockReturnValue(menuQuery);
menuQuery.order.mockReturnValue(menuQuery);

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(() => ({ maybeSingle })),
    from: vi.fn(() => menuQuery),
  },
}));

vi.mock("@/lib/order-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/order-client")>();
  return {
    ...actual,
    orderClient: {
      ...actual.orderClient,
      create: vi.fn(),
      get: vi.fn(),
    },
  };
});

vi.mock("@/lib/payment-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payment-client")>();
  return {
    ...actual,
    paymentClient: {
      ...actual.paymentClient,
      startHosted: vi.fn(),
    },
  };
});

describe("checkout online do delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(`vapt_delivery_address_${restaurant.id}`, JSON.stringify({
      customerName: "Cliente Teste",
      phone: "61999999999",
      street: "Rua Um",
      number: "42",
      neighborhood: "Centro",
    }));
    vi.mocked(orderClient.create).mockResolvedValue({
      orderId: "20000000-0000-4000-8000-000000000001",
      displayId: 42,
      restaurantId: restaurant.id,
      tableSessionId: null,
      totalPrice: "23.00",
      status: "waiting_payment",
      paymentStatus: null,
      publicToken: "opaque-public-order-token-that-is-long-enough",
      idempotentReplay: false,
    });
    vi.mocked(orderClient.get).mockResolvedValue({
      orderId: "20000000-0000-4000-8000-000000000001",
      displayId: 42,
      restaurantId: restaurant.id,
      tableSessionId: null,
      totalPrice: "23.00",
      status: "waiting_payment",
      paymentStatus: null,
      channel: "delivery",
      tableNumber: null,
      createdAt: "2026-08-19T12:00:00.000Z",
      items: [],
    });
    vi.mocked(paymentClient.startHosted).mockResolvedValue({
      transactionId: "40000000-0000-4000-8000-000000000001",
      orderId: "20000000-0000-4000-8000-000000000001",
      status: "pending",
      amount: { amount: "23.00", currency: "BRL" },
      checkoutUrl: "javascript:invalid-checkout",
      expiresAt: null,
    });
  });

  it("cria o pedido como online e inicia o checkout hospedado", async () => {
    render(
      <MemoryRouter initialEntries={["/delivery/restaurante-teste"]}>
        <Routes>
          <Route path="/delivery/:slug" element={<PublicDelivery />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /adicionar/i }));
    fireEvent.click(screen.getByRole("button", { name: /pagar online/i }));

    await waitFor(() => expect(orderClient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "delivery",
        delivery: expect.objectContaining({ paymentMode: "online" }),
      }),
      expect.any(String),
    ));
    expect(paymentClient.startHosted).toHaveBeenCalledWith(
      "20000000-0000-4000-8000-000000000001",
      "opaque-public-order-token-that-is-long-enough",
      expect.stringMatching(/^checkout-/),
    );
  });

  it("mantém pagamento na entrega sem iniciar checkout hospedado", async () => {
    render(
      <MemoryRouter initialEntries={["/delivery/restaurante-teste"]}>
        <Routes>
          <Route path="/delivery/:slug" element={<PublicDelivery />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /adicionar/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /pagar na entrega/i })[0]);

    await waitFor(() => expect(orderClient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "delivery",
        delivery: expect.objectContaining({ paymentMode: "on_delivery" }),
      }),
      expect.any(String),
    ));
    expect(paymentClient.startHosted).not.toHaveBeenCalled();
  });

  it("permite continuar um checkout pendente sem criar outro pedido", async () => {
    localStorage.setItem(`vapt_delivery_recent_orders_${restaurant.id}`, JSON.stringify([{
      id: "20000000-0000-4000-8000-000000000001",
      publicToken: "opaque-public-order-token-that-is-long-enough",
      displayId: 42,
      status: "waiting_payment",
      deliveredAt: null,
      total: 23,
      createdAt: "2026-08-19T12:00:00.000Z",
      items: [{ itemId: menuItem.id, name: menuItem.name, price: 23, quantity: 1 }],
    }]));
    savePendingCheckout({
      orderId: "20000000-0000-4000-8000-000000000001",
      publicToken: "opaque-public-order-token-that-is-long-enough",
      transactionId: "40000000-0000-4000-8000-000000000001",
      returnPath: "/delivery/restaurante-teste",
      checkoutUrl: "https://sandbox.mercadopago.com.br/checkout/v1/redirect/pending",
      expiresAt: null,
    });

    render(
      <MemoryRouter initialEntries={["/delivery/restaurante-teste"]}>
        <Routes>
          <Route path="/delivery/:slug" element={<PublicDelivery />} />
        </Routes>
      </MemoryRouter>,
    );

    const resumeLink = await screen.findByRole("link", { name: /continuar pagamento/i });
    expect(resumeLink).toHaveAttribute(
      "href",
      "https://sandbox.mercadopago.com.br/checkout/v1/redirect/pending",
    );
    expect(orderClient.create).not.toHaveBeenCalled();
  });
});
