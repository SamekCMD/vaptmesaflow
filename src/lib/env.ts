const readEnv = (key: string, fallback = ""): string => {
  const value = (import.meta.env as Record<string, string>)[key];
  return typeof value === "string" ? value : fallback;
};

export const ENV = {
  supabaseUrl: readEnv("VITE_SUPABASE_URL"),
  supabaseAnonKey: readEnv("VITE_SUPABASE_PUBLISHABLE_KEY", readEnv("VITE_SUPABASE_ANON_KEY")),
  stripePublishableKey: readEnv("VITE_STRIPE_PUBLISHABLE_KEY"),
  stripePriceStarter: readEnv("VITE_STRIPE_PRICE_STARTER"),
  stripePricePro: readEnv("VITE_STRIPE_PRICE_PRO"),
  stripePriceBusiness: readEnv("VITE_STRIPE_PRICE_BUSINESS"),
  n8nCheckoutWebhookUrl: readEnv("VITE_N8N_CHECKOUT_WEBHOOK_URL"),
  n8nWebhookUrl: readEnv("VITE_N8N_WEBHOOK_URL"),
  vapidPublicKey: readEnv("VITE_VAPID_PUBLIC_KEY"),
  pushSubscribeWebhook: readEnv("VITE_PUSH_SUBSCRIBE_WEBHOOK_URL"),
} as const;

export const buildSupabaseStoragePublicUrl = (bucket: string, path: string): string =>
  `${ENV.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
