import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CurrentPaymentMethodsCard from "@/components/payments/CurrentPaymentMethodsCard";

describe("meios de pagamento atuais", () => {
  it("explica a confirmacao manual e lista os meios disponiveis no caixa", () => {
    render(<CurrentPaymentMethodsCard />);

    expect(screen.getByText("Usar meus meios atuais")).toBeInTheDocument();
    expect(screen.getByText(/confirmado pelo operador no Vapt/i)).toBeInTheDocument();

    for (const method of ["Dinheiro", "Pix externo", "Crédito", "Débito", "Vale", "Outro"]) {
      expect(screen.getByText(method)).toBeInTheDocument();
    }

    expect(screen.queryByText(/api key|access token|cpf|cnpj/i)).not.toBeInTheDocument();
  });
});
