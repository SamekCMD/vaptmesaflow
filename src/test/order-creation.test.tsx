import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createOrderIdempotencyKey,
  orderClient,
  readStoredOrderAccess,
  saveStoredOrderAccess,
} from "@/lib/order-client";
import {
  paymentClient,
  readPendingCheckout,
  savePendingCheckout,
} from "@/lib/payment-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("criação pública de pedidos", () => {
  it("envia somente referências de catálogo e nunca envia preço ou status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      orderId: "20000000-0000-0000-0000-000000000001",
      displayId: 42,
      restaurantId: "30000000-0000-0000-0000-000000000001",
      tableSessionId: null,
      totalPrice: "51.80",
      status: "pending",
      paymentStatus: null,
      publicToken: "opaque-public-order-token-that-is-long-enough",
      idempotentReplay: false,
    }), { status: 201, headers: { "content-type": "application/json" } }));
    globalThis.fetch = fetchMock;

    const result = await orderClient.create({
      restaurantSlug: "restaurante-teste",
      channel: "delivery",
      items: [{ menuItemId: "10000000-0000-0000-0000-000000000001", quantity: 2 }],
      delivery: {
        name: "Cliente Teste",
        phone: "61999999999",
        street: "Rua Um",
        number: "42",
        neighborhood: "Centro",
      },
    }, "order-attempt-0001");

    expect(result.totalPrice).toBe("51.80");
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toMatchObject({ "Idempotency-Key": "order-attempt-0001" });
    const body = JSON.parse(String(options.body));
    expect(body.items[0]).toEqual({
      menuItemId: "10000000-0000-0000-0000-000000000001",
      quantity: 2,
    });
    expect(body).not.toHaveProperty("totalPrice");
    expect(body).not.toHaveProperty("restaurantId");
    expect(body).not.toHaveProperty("status");
  });

  it("consulta cada pedido com seu token opaco", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      orderId: "20000000-0000-0000-0000-000000000001",
      totalPrice: "51.80",
      status: "preparing",
      items: [],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    globalThis.fetch = fetchMock;

    await orderClient.get(
      "20000000-0000-0000-0000-000000000001",
      "opaque-public-order-token-that-is-long-enough",
    );

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toMatchObject({
      "X-Vapt-Order-Token": "opaque-public-order-token-that-is-long-enough",
    });
  });

  it("inicia o checkout hospedado com token opaco e sem enviar valor", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      transactionId: "40000000-0000-4000-8000-000000000001",
      orderId: "20000000-0000-4000-8000-000000000001",
      status: "pending",
      amount: { amount: "51.80", currency: "BRL" },
      checkoutUrl: "https://sandbox.mercadopago.com.br/checkout/v1/redirect/test",
      expiresAt: null,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    globalThis.fetch = fetchMock;

    await paymentClient.startHosted(
      "20000000-0000-4000-8000-000000000001",
      "opaque-public-order-token-that-is-long-enough",
      "checkout-attempt-0001",
    );

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toMatchObject({
      "Idempotency-Key": "checkout-attempt-0001",
      "X-Vapt-Order-Token": "opaque-public-order-token-that-is-long-enough",
    });
    expect(JSON.parse(String(options.body))).toEqual({});
    expect(url).toContain(
      "/public/orders/20000000-0000-4000-8000-000000000001/payments/checkout",
    );
  });

  it("persiste somente o contexto opaco necessário para confirmar o retorno", () => {
    savePendingCheckout({
      orderId: "20000000-0000-4000-8000-000000000001",
      publicToken: "opaque-public-order-token-that-is-long-enough",
      transactionId: "40000000-0000-4000-8000-000000000001",
      returnPath: "/menu/restaurante-teste?table=4",
    });

    expect(readPendingCheckout()).toEqual({
      orderId: "20000000-0000-4000-8000-000000000001",
      publicToken: "opaque-public-order-token-that-is-long-enough",
      transactionId: "40000000-0000-4000-8000-000000000001",
      returnPath: "/menu/restaurante-teste?table=4",
    });
  });

  it("persiste apenas id e token necessários para acompanhar pedidos", () => {
    saveStoredOrderAccess("restaurant-1", {
      orderId: "order-1",
      publicToken: "token-1",
    });
    saveStoredOrderAccess("restaurant-1", {
      orderId: "order-1",
      publicToken: "token-1",
    });

    expect(readStoredOrderAccess("restaurant-1")).toEqual([
      { orderId: "order-1", publicToken: "token-1" },
    ]);
  });

  it("gera chaves de idempotência diferentes para tentativas independentes", () => {
    expect(createOrderIdempotencyKey()).not.toBe(createOrderIdempotencyKey());
  });
});
