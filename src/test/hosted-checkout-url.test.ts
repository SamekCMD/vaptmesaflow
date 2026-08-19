import { describe, expect, it } from "vitest";
import { parseHostedCheckoutUrl } from "@/lib/hosted-checkout-url";

describe("parseHostedCheckoutUrl", () => {
  it("accepts secure Mercado Pago checkout hosts", () => {
    expect(
      parseHostedCheckoutUrl("https://sandbox.mercadopago.com.br/checkout/v1/redirect/abc").hostname,
    ).toBe("sandbox.mercadopago.com.br");
  });

  it.each([
    "http://mercadopago.com.br/checkout",
    "https://mercadopago.com.br.evil.example/checkout",
    "javascript:alert(1)",
  ])("rejects unsafe checkout URL %s", (checkoutUrl) => {
    expect(() => parseHostedCheckoutUrl(checkoutUrl)).toThrow(
      "O servidor retornou um endereço de pagamento inválido.",
    );
  });
});
