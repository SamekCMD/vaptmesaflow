const INVALID_CHECKOUT_URL_MESSAGE = "O servidor retornou um endereço de pagamento inválido.";

export function parseHostedCheckoutUrl(value: string): URL {
  let checkoutUrl: URL;

  try {
    checkoutUrl = new URL(value);
  } catch {
    throw new Error(INVALID_CHECKOUT_URL_MESSAGE);
  }

  const isMercadoPagoHost =
    checkoutUrl.hostname === "mercadopago.com.br" ||
    checkoutUrl.hostname.endsWith(".mercadopago.com.br");

  if (checkoutUrl.protocol !== "https:" || !isMercadoPagoHost) {
    throw new Error(INVALID_CHECKOUT_URL_MESSAGE);
  }

  return checkoutUrl;
}
