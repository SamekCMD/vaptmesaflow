import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { orderClient } from "@/lib/order-client";
import { paymentClient, savePendingCheckout } from "@/lib/payment-client";
import { vaptApiRequest } from "@/lib/vapt-api-client";
import PublicDelivery from "@/pages/delivery/PublicDelivery";
import type { RealtimeScope } from "@/lib/realtime/contracts";
import type { subscribeRealtime } from "@/lib/realtime/client";

const realtime = vi.hoisted(() => ({ consumers: [] as Array<{ scope: RealtimeScope; signal: Parameters<typeof subscribeRealtime>[1] }> }));
vi.mock("@/lib/env", async original => ({ ENV: { ...(await original<typeof import("@/lib/env")>()).ENV, realtimeEnabled: true } }));
vi.mock("@/lib/realtime/client", () => ({ subscribeRealtime: (scope, signal, state) => {
  const consumer = { scope, signal }; realtime.consumers.push(consumer); state("fallback");
  return () => { realtime.consumers = realtime.consumers.filter(item => item !== consumer); };
} }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

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

vi.mock("@/lib/vapt-api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vapt-api-client")>();
  return {
    ...actual,
    vaptApiRequest: vi.fn(),
  };
});

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
    realtime.consumers = [];
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
    vi.mocked(vaptApiRequest).mockResolvedValue({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        whatsapp: null,
        address: null,
        phone: null,
        hours: null,
        description: null,
        primaryColor: restaurant.primary_color,
        secondaryColor: restaurant.secondary_color,
        fontFamily: restaurant.font_family,
        logoUrl: restaurant.logo_url,
        totalTables: 1,
        maxTables: 1,
        paymentMode: "open_tab",
        maxPendingOrders: 3,
        localEnabled: true,
        deliveryEnabled: true,
        updatedAt: "2026-09-25T12:00:00.000Z",
      },
      items: [{
        id: menuItem.id,
        restaurantId: restaurant.id,
        name: menuItem.name,
        description: menuItem.description,
        price: "23.00",
        category: menuItem.category,
        imageUrl: menuItem.image_url,
        available: true,
        availableFrom: null,
        availableUntil: null,
        badge: null,
        isChefSuggestion: false,
        prepTimeMinutes: null,
        createdAt: "2026-09-25T12:00:00.000Z",
        updatedAt: "2026-09-25T12:00:00.000Z",
        variations: [],
      }],
    });
  });

  it("atualiza o acompanhamento somente do ultimo pedido autorizado por sinal", async () => {
    const orderId = "20000000-0000-4000-8000-000000000001";
    const publicToken = "opaque-public-order-token-that-is-long-enough";
    localStorage.setItem(`vapt_delivery_recent_orders_${restaurant.id}`, JSON.stringify([{
      id: orderId, publicToken, displayId: 42, status: "waiting_payment", deliveredAt: null,
      total: 23, createdAt: new Date().toISOString(), items: [],
    }]));
    const view = render(<MemoryRouter initialEntries={["/delivery/restaurante-teste"]}><Routes>
      <Route path="/delivery/:slug" element={<PublicDelivery />} />
    </Routes></MemoryRouter>);
    await screen.findByRole("button", { name: /adicionar/i });
    await waitFor(() => expect(realtime.consumers.map(item => item.scope)).toEqual([{ mode: "order", orderId, token: publicToken }]));
    vi.useFakeTimers();
    vi.mocked(orderClient.get).mockResolvedValue({ ...(await vi.mocked(orderClient.get).mock.results[0].value), status: "ready" });
    const calls = vi.mocked(orderClient.get).mock.calls.length;
    await act(async () => {
      for (const consumer of realtime.consumers) {
        const signal = { version: 1 as const, eventId: "40000000-0000-4000-8000-000000000001", sequence: 1,
          topic: "orders" as const, entityId: orderId, reason: "updated" as const };
        consumer.signal(signal); consumer.signal(signal);
      }
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(screen.getAllByText("Saiu para entrega").length).toBeGreaterThan(0);
    expect(orderClient.get).toHaveBeenCalledTimes(calls + 1);
    expect(JSON.parse(localStorage.getItem(`vapt_delivery_recent_orders_${restaurant.id}`)!)[0].status).toBe("ready");
    view.unmount(); expect(realtime.consumers).toHaveLength(0);
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
    expect(vaptApiRequest).toHaveBeenCalledWith({
      method: "GET",
      route: "/public/restaurants/restaurante-teste/catalog",
      requireAuth: false,
    });
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

  it("impede o envio de um endereco salvo que nao atende ao contrato da API", async () => {
    localStorage.setItem(`vapt_delivery_address_${restaurant.id}`, JSON.stringify({
      customerName: "Cliente Teste",
      phone: "345235",
      street: "Rua Um",
      number: "42",
      neighborhood: "Centro",
    }));

    render(
      <MemoryRouter initialEntries={["/delivery/restaurante-teste"]}>
        <Routes>
          <Route path="/delivery/:slug" element={<PublicDelivery />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /adicionar/i }));
    fireEvent.click(screen.getByRole("button", { name: /pagar online/i }));

    expect(await screen.findByLabelText("Telefone")).toBeInTheDocument();
    expect(orderClient.create).not.toHaveBeenCalled();
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
