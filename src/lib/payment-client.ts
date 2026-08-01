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

export const paymentClient = {
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
