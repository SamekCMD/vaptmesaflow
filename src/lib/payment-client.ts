import { vaptApiRequest } from "@/lib/vapt-api-client";

export type ManualPaymentMethod =
  | "cash"
  | "external_pix"
  | "credit_card"
  | "debit_card"
  | "voucher"
  | "other";

export type ManualPaymentResponse = {
  transactionId: string;
  orderId: string;
  status: "paid";
  amount: {
    amount: string;
    currency: string;
  };
  paymentMethod: ManualPaymentMethod;
  confirmedAt: string;
};

export type HostedCheckoutResponse = {
  transactionId: string;
  orderId: string;
  status: string;
  amount: {
    amount: string;
    currency: string;
  };
  checkoutUrl: string;
  expiresAt: string | null;
};

export type PendingCheckout = {
  orderId: string;
  publicToken: string;
  transactionId: string;
  returnPath: string;
};

export type PaymentEnvironment = "sandbox" | "production";

export type MercadoPagoConnectionStatus = {
  connected: boolean;
  status: "active" | "disconnected" | "expired" | "invalid" | string;
  externalAccountId?: string;
  environment?: PaymentEnvironment;
  tokenExpiresAt?: string | null;
};

export type MercadoPagoAuthorization = {
  authorizationUrl: string;
};

const PENDING_CHECKOUT_STORAGE_KEY = "vapt_pending_checkout";

function isSafeReturnPath(value: unknown): value is string {
  return typeof value === "string" &&
    (value.startsWith("/menu/") || value.startsWith("/delivery/")) &&
    !value.startsWith("//");
}

export function savePendingCheckout(checkout: PendingCheckout): void {
  localStorage.setItem(PENDING_CHECKOUT_STORAGE_KEY, JSON.stringify(checkout));
}

export function readPendingCheckout(): PendingCheckout | null {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY) ?? "null") as unknown;
    if (
      typeof value !== "object" ||
      value === null ||
      typeof (value as PendingCheckout).orderId !== "string" ||
      typeof (value as PendingCheckout).publicToken !== "string" ||
      typeof (value as PendingCheckout).transactionId !== "string" ||
      !isSafeReturnPath((value as PendingCheckout).returnPath)
    ) {
      return null;
    }
    return value as PendingCheckout;
  } catch {
    return null;
  }
}

export function clearPendingCheckout(): void {
  localStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
}

export const paymentClient = {
  startHosted(
    orderId: string,
    publicToken: string,
    idempotencyKey: string,
  ) {
    return vaptApiRequest<HostedCheckoutResponse>({
      route: `/public/orders/${encodeURIComponent(orderId)}/payments/checkout`,
      requireAuth: false,
      headers: {
        "Idempotency-Key": idempotencyKey,
        "X-Vapt-Order-Token": publicToken,
      },
      body: {},
    });
  },

  confirmManual(
    orderId: string,
    paymentMethod: ManualPaymentMethod,
    idempotencyKey: string,
  ) {
    return vaptApiRequest<ManualPaymentResponse>({
      route: `/orders/${encodeURIComponent(orderId)}/payments/manual-confirmation`,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      body: {
        paymentMethod,
      },
    });
  },
};

export const paymentConnectionClient = {
  getMercadoPagoStatus(
    restaurantId: string,
    environment: PaymentEnvironment,
  ) {
    return vaptApiRequest<MercadoPagoConnectionStatus>({
      method: "GET",
      route: `/restaurants/${encodeURIComponent(restaurantId)}/payments/mercado-pago/status`,
      query: { environment },
    });
  },

  connectMercadoPago(
    restaurantId: string,
    environment: PaymentEnvironment,
    returnOrigin: string,
  ) {
    return vaptApiRequest<MercadoPagoAuthorization>({
      route: `/restaurants/${encodeURIComponent(restaurantId)}/payments/mercado-pago/connect`,
      body: { environment, returnOrigin },
    });
  },

  disconnectMercadoPago(
    restaurantId: string,
    environment: PaymentEnvironment,
  ) {
    return vaptApiRequest<MercadoPagoConnectionStatus>({
      method: "DELETE",
      route: `/restaurants/${encodeURIComponent(restaurantId)}/payments/mercado-pago/connection`,
      query: { environment },
    });
  },
};
