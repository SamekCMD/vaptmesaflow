import { z } from "zod";
import { VaptApiClientError, vaptApiRequest } from "@/lib/vapt-api-client";

export type BillingPlanType = "starter" | "pro" | "business";
export type BillingPlanStatus = "trialing" | "active" | "past_due" | "incomplete" | "unpaid" | "paused" | "expired" | "cancelled";
const statusSchema = z.object({
  planType: z.enum(["starter", "pro", "business"]),
  planStatus: z.enum(["trialing", "active", "past_due", "incomplete", "unpaid", "paused", "expired", "cancelled"]),
  trialEndsAt: z.string().datetime().nullable(), currentPeriodEnd: z.string().datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(), subscriptionCanceledAt: z.string().datetime().nullable(),
  canManageBilling: z.boolean(), requiresBillingAction: z.boolean(),
});
export type BillingStatus = z.infer<typeof statusSchema>;
function invalidResponse(): never {
  throw new VaptApiClientError("invalid_billing_response", "Não foi possível abrir a cobrança. Tente novamente.", 502);
}
function safeUrl(value: unknown, hostname: string): string {
  if (typeof value !== "string") invalidResponse();
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== hostname || url.username || url.password || url.port) invalidResponse();
    return url.href;
  } catch { invalidResponse(); }
}
export const billingClient = {
  async createCheckout(input: { restaurantId: string; planType: BillingPlanType }) {
    const result = await vaptApiRequest<{ checkoutSessionId: string; url: string }>({
      route: "/billing/stripe/checkout", headers: { "Idempotency-Key": crypto.randomUUID() },
      body: { restaurantId: input.restaurantId, planType: input.planType },
    });
    if (!result || typeof result.checkoutSessionId !== "string" || !result.checkoutSessionId) invalidResponse();
    return { checkoutSessionId: result.checkoutSessionId, url: safeUrl(result.url, "checkout.stripe.com") };
  },
  async createPortal(restaurantId: string) {
    const result = await vaptApiRequest<{ url: string }>({ route: "/billing/stripe/portal", body: { restaurantId } });
    return { url: safeUrl(result?.url, "billing.stripe.com") };
  },
  async getSubscriptionStatus(restaurantId: string): Promise<BillingStatus> {
    const result = statusSchema.safeParse(await vaptApiRequest({ method: "GET",
      route: "/billing/stripe/subscription", query: { restaurantId } }));
    if (!result.success) invalidResponse();
    return result.data;
  },
};
export function redirectToBilling(value: string): void {
  // Validate again at the navigation boundary. Never log short-lived provider URLs.
  const url = new URL(value);
  if (url.hostname !== "checkout.stripe.com" && url.hostname !== "billing.stripe.com") invalidResponse();
  window.location.assign(safeUrl(value, url.hostname));
}
