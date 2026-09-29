import { BILLING_URL, parseSnapshot } from './contracts.js';
import type { BillingEmailKind, BillingPlanType, EmailSnapshot } from './contracts.js';

const aliases: Record<BillingEmailKind, string> = {
  subscription_activated: 'billing-subscription-activated',
  subscription_renewed: 'billing-subscription-renewed',
  payment_failed: 'billing-payment-failed',
  subscription_cancelled: 'billing-subscription-cancelled',
};

const planLabels: Record<BillingPlanType, string> = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
};

export function snapshotFor(
  kind: BillingEmailKind,
  restaurantName: string,
  planType: BillingPlanType,
  recipientEmail: string,
): EmailSnapshot {
  return parseSnapshot({
    to: recipientEmail,
    templateAlias: aliases[kind],
    variables: {
      RESTAURANT_NAME: restaurantName,
      PLAN_NAME: planLabels[planType],
      BILLING_URL,
    },
  });
}
