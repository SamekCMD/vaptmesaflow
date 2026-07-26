import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createOrderIdempotencyKey,
  orderClient,
  readStoredOrderAccess,
  saveStoredOrderAccess,
} from "@/lib/order-client";
import { n8nClient } from "@/lib/n8n-client";

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

  it("autoriza o Pix público com token opaco e sem enviar valor", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      paymentId: "payment-1",
      qrCodeBase64: "qr",
      pixPayload: "pix",
      expiration: "2026-07-25T23:59:59.000Z",
      status: "pending",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    globalThis.fetch = fetchMock;

    await n8nClient.asaas.createPix({
      restaurantId: "restaurant-1",
      orderId: "order-1",
      publicToken: "opaque-public-order-token-that-is-long-enough",
      totalPrice: 0.01,
      public: true,
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({
      restaurantId: "restaurant-1",
      orderId: "order-1",
      publicToken: "opaque-public-order-token-that-is-long-enough",
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
