import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import PaymentReturn from "@/pages/payment/PaymentReturn";

function renderReturn(search: string) {
  render(
    <MemoryRouter initialEntries={[`/payment/return${search}`]}>
      <PaymentReturn />
    </MemoryRouter>,
  );
}

describe("Mercado Pago return page", () => {
  it("explains that an approved checkout is being confirmed by the webhook", () => {
    renderReturn("?result=success&status=approved");

    expect(screen.getByRole("heading", { name: "Pagamento recebido" })).toBeInTheDocument();
    expect(screen.getByText(/confirmando o pedido/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao Vapt" })).toHaveAttribute("href", "/");
  });

  it("shows a pending state without claiming that the order is paid", () => {
    renderReturn("?result=pending&status=pending");

    expect(screen.getByRole("heading", { name: "Pagamento em análise" })).toBeInTheDocument();
    expect(screen.queryByText("Pagamento recebido")).not.toBeInTheDocument();
  });

  it("offers a safe retry path after a failed checkout", () => {
    renderReturn("?result=failure&status=rejected");

    expect(screen.getByRole("heading", { name: "Pagamento não concluído" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar para tentar novamente" })).toBeInTheDocument();
  });
});
