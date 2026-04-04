import { ENV } from "@/lib/env";

export const STRIPE_PUBLISHABLE_KEY = ENV.stripePublishableKey;
export const STRIPE_PRICE_STARTER = ENV.stripePriceStarter;
export const STRIPE_PRICE_PRO = ENV.stripePricePro;
export const STRIPE_PRICE_BUSINESS = ENV.stripePriceBusiness;
export const N8N_CHECKOUT_WEBHOOK_URL = ENV.n8nCheckoutWebhookUrl;
export const N8N_WEBHOOK_URL = ENV.n8nWebhookUrl;
