import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ManualPaymentDialog from "@/components/payments/ManualPaymentDialog";
import { paymentClient } from "@/lib/payment-client";

vi.mock("@/lib/payment-client", () => ({
  paymentClient: {
    confirmManual: vi.fn(),
  },
}));

const orders = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    displayId: 41,
    totalPrice: 23,
    paymentStatus: null,
    paymentConfirmedAt: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    displayId: 42,
    totalPrice: 19.5,
    paymentStatus: null,
    paymentConfirmedAt: null,
  },
];

function renderDialog(onConfirmed = vi.fn()) {
  render(
    <ManualPaymentDialog
      open
      onOpenChange={vi.fn()}
      orders={orders}
      onConfirmed={onConfirmed}
    />,
  );
  return { onConfirmed };
}

describe("manual payment dialog", () => {
  afterEach(() => vi.clearAllMocks());

  it("sends only the order identity, payment method and idempotency key", async () => {
    vi.mocked(paymentClient.confirmManual).mockResolvedValue({
      transactionId: "transaction-1",
      orderId: orders[0].id,
      status: "paid",
      amount: { amount: "23.00", currency: "BRL" },
      paymentMethod: "cash",
      confirmedAt: "2026-08-01T12:00:00.000Z",
    });
    renderDialog();


    fireEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));

    await waitFor(() => expect(paymentClient.confirmManual).toHaveBeenCalledTimes(2));
    for (const call of vi.mocked(paymentClient.confirmManual).mock.calls) {
      expect(call).toHaveLength(3);
      expect(call[1]).toBe("cash");
      expect(call[2]).toMatch(/^manual-/);
      expect(call.flat()).not.toContain(23);
      expect(call.flat()).not.toContain(19.5);
    }
  });

  it("blocks a duplicate click while the confirmation is pending", async () => {
    let resolve!: () => void;
    vi.mocked(paymentClient.confirmManual).mockImplementation(
      () => new Promise((done) => { resolve = () => done({
        transactionId: "transaction-1",
        orderId: orders[0].id,
        status: "paid",
        amount: { amount: "23.00", currency: "BRL" },
        paymentMethod: "cash",
        confirmedAt: "2026-08-01T12:00:00.000Z",
      }); }),
    );
    renderDialog();

    const button = screen.getByRole("button", { name: "Confirmar recebimento" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(paymentClient.confirmManual).toHaveBeenCalledTimes(1);
    resolve();
    await waitFor(() => expect(paymentClient.confirmManual).toHaveBeenCalledTimes(2));
  });

  it("finishes only after every unpaid order is confirmed", async () => {
    vi.mocked(paymentClient.confirmManual).mockResolvedValue({
      transactionId: "transaction-1",
      orderId: orders[0].id,
      status: "paid",
      amount: { amount: "23.00", currency: "BRL" },
      paymentMethod: "cash",
      confirmedAt: "2026-08-01T12:00:00.000Z",
    });
    const { onConfirmed } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledOnce());
    expect(paymentClient.confirmManual).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, "Sua sessão expirou. Entre novamente para confirmar o pagamento."],
    [403, "Você não tem permissão para confirmar este pagamento."],
    [409, "Este pagamento já foi confirmado ou está sendo processado. Atualize o caixa."],
    [0, "Não foi possível confirmar agora. Verifique a conexão e tente novamente."],
  ])("shows a safe message for status %s", async (status, message) => {
    vi.mocked(paymentClient.confirmManual).mockRejectedValue({ status });
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar recebimento" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });
});
