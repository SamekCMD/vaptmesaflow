const readEnv = (key: string, fallback = ""): string => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
};

// Frontend config is already public in the shipped bundle. These fallbacks keep
// local Vite and Lovable preview working even when VITE_* injection is absent.
const PUBLIC_DEFAULTS = {
  supabaseUrl: "https://samuel-supabase.br8r5p.easypanel.host",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE",
  stripePublishableKey: "pk_test_51T8nHVAhzmizeEVEptm4KD0kVliAANkxAB4IKbl0DccLprRaTD7ztfN9bkquk1ax6ZnmwjiahIdNJJQ7fDUGh9zf005sWQvYaE",
  stripePriceStarter: "price_1T8nKuAhzmizeEVEsV60CdhT",
  stripePricePro: "price_1T8nLcAhzmizeEVExZvLA89J",
  stripePriceBusiness: "price_1T8nMKAhzmizeEVEnUhLkBif",
  n8nWebhookBaseUrl: "https://samuel-n8n.br8r5p.easypanel.host/webhook",
  vaptAppEndpointSecret: "R1JyiaOg59ZcbSQSBq2Jd+baYs8bdWhuiPCTdBVOxsv9Z+vt2upYbfVt+7aVre2l",
  vaptWebhookSetupSecret: "Mhf7zHdEGshvk1IAeHgFYsn75syJTlkHxmqB2wOyceY+VWpkaDYN2Mosp7PSth3v",
  vaptAdminEndpointSecret: "DpDh4LBxKphvJEgMqSHEAFNq4uG34FKvITAOBbjFcxJRxmUkeuzaixSOoMZugm0e",
} as const;

export const ENV = {
  supabaseUrl: readEnv("VITE_EXT_SUPABASE_URL", readEnv("VITE_SUPABASE_URL", PUBLIC_DEFAULTS.supabaseUrl)),
  supabaseAnonKey: readEnv(
    "VITE_EXT_SUPABASE_ANON_KEY",
    readEnv("VITE_SUPABASE_PUBLISHABLE_KEY", readEnv("VITE_SUPABASE_ANON_KEY", PUBLIC_DEFAULTS.supabaseAnonKey))
  ),
  stripePublishableKey: readEnv("VITE_STRIPE_PUBLISHABLE_KEY", PUBLIC_DEFAULTS.stripePublishableKey),
  stripePriceStarter: readEnv("VITE_STRIPE_PRICE_STARTER", PUBLIC_DEFAULTS.stripePriceStarter),
  stripePricePro: readEnv("VITE_STRIPE_PRICE_PRO", PUBLIC_DEFAULTS.stripePricePro),
  stripePriceBusiness: readEnv("VITE_STRIPE_PRICE_BUSINESS", PUBLIC_DEFAULTS.stripePriceBusiness),
  n8nWebhookBaseUrl: readEnv("VITE_N8N_WEBHOOK_BASE_URL", PUBLIC_DEFAULTS.n8nWebhookBaseUrl),
  vaptAppEndpointSecret: readEnv("VITE_VAPT_APP_ENDPOINT_SECRET", PUBLIC_DEFAULTS.vaptAppEndpointSecret),
  vaptWebhookSetupSecret: readEnv("VITE_VAPT_WEBHOOK_SETUP_SECRET", PUBLIC_DEFAULTS.vaptWebhookSetupSecret),
  vaptAdminEndpointSecret: readEnv("VITE_VAPT_ADMIN_ENDPOINT_SECRET", PUBLIC_DEFAULTS.vaptAdminEndpointSecret),
  vapidPublicKey: readEnv("VITE_VAPID_PUBLIC_KEY"),
} as const;

export const buildSupabaseStoragePublicUrl = (bucket: string, path: string): string =>
  `${ENV.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
