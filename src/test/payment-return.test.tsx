import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { orderClient } from "@/lib/order-client";
import { savePendingCheckout } from "@/lib/payment-client";
import PaymentReturn from "@/pages/payment/PaymentReturn";

vi.mock("@/lib/order-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/order-client")>("@/lib/order-client");
  return {
    ...actual,
    orderClient: {
      ...actual.orderClient,
      get: vi.fn(),
    },
  };
});

const getOrderMock = vi.mocked(orderClient.get);

const order = (paymentStatus: string | null) => ({
  orderId: "20000000-0000-4000-8000-000000000001",
  displayId: 42,
  restaurantId: "30000000-0000-4000-8000-000000000001",
  tableSessionId: null,
  totalPrice: "51.80",
  status: "pending",
  paymentStatus,
  channel: "local" as const,
  tableNumber: "4",
  createdAt: "2026-08-18T12:00:00.000Z",
  items: [],
});

function saveCheckoutContext() {
  savePendingCheckout({
    orderId: "20000000-0000-4000-8000-000000000001",
    publicToken: "opaque-public-order-token-that-is-long-enough",
    transactionId: "40000000-0000-4000-8000-000000000001",
    returnPath: "/menu/restaurante-teste?table=4",
  });
}

function renderReturn(search: string) {
  render(
    <MemoryRouter initialEntries={[`/payment/return${search}`]}>
      <PaymentReturn />
    </MemoryRouter>,
  );
}

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("retorno do Mercado Pago", () => {
  it("não confia no sucesso da URL enquanto a API informa pagamento pendente", async () => {
    saveCheckoutContext();
    getOrderMock.mockResolvedValue(order("pending"));

    renderReturn("?result=success&status=approved&external_reference=40000000-0000-4000-8000-000000000001");

    expect(await screen.findByRole("heading", { name: "Confirmando pagamento" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pagamento confirmado" })).not.toBeInTheDocument();
    await waitFor(() => expect(getOrderMock).toHaveBeenCalledWith(
      "20000000-0000-4000-8000-000000000001",
      "opaque-public-order-token-that-is-long-enough",
    ));
  });

  it("mostra sucesso somente quando a API confirma o pagamento", async () => {
    saveCheckoutContext();
    getOrderMock.mockResolvedValue(order("paid"));

    renderReturn("?result=success&status=approved&external_reference=40000000-0000-4000-8000-000000000001");

    expect(await screen.findByRole("heading", { name: "Pagamento confirmado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao pedido" })).toHaveAttribute(
      "href",
      "/menu/restaurante-teste?table=4",
    );
  });

  it("mostra falha quando a API registra uma transação recusada", async () => {
    saveCheckoutContext();
    getOrderMock.mockResolvedValue(order("failed"));

    renderReturn("?result=failure&status=rejected&external_reference=40000000-0000-4000-8000-000000000001");

    expect(await screen.findByRole("heading", { name: "Pagamento não concluído" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao pedido" })).toHaveAttribute(
      "href",
      "/menu/restaurante-teste?table=4",
    );
  });

  it("não consulta nem confirma um retorno sem contexto local correspondente", () => {
    renderReturn("?result=success&status=approved&external_reference=transacao-desconhecida");

    expect(screen.getByRole("heading", { name: "Não localizamos este pedido" })).toBeInTheDocument();
    expect(getOrderMock).not.toHaveBeenCalled();
  });
});
