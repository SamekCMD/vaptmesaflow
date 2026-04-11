const readEnv = (key: string, fallback = ""): string => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
};

const isTest = import.meta.env.MODE === "test";

const readRequiredEnv = (key: string): string => {
  const value = readEnv(key);
  if (value) return value;

  if (isTest) {
    return `__${key.toLowerCase()}__`;
  }

  throw new Error(`[ENV] Missing required variable: ${key}`);
};

export const ENV = {
  supabaseUrl: readRequiredEnv("VITE_SUPABASE_URL"),
  supabaseAnonKey: readRequiredEnv("VITE_SUPABASE_ANON_KEY"),
  stripePublishableKey: readRequiredEnv("VITE_STRIPE_PUBLISHABLE_KEY"),
  stripePriceStarter: readRequiredEnv("VITE_STRIPE_PRICE_STARTER"),
  stripePricePro: readRequiredEnv("VITE_STRIPE_PRICE_PRO"),
  stripePriceBusiness: readRequiredEnv("VITE_STRIPE_PRICE_BUSINESS"),
  vaptApiBaseUrl: readRequiredEnv("VITE_VAPT_API_BASE_URL"),
  vapidPublicKey: readEnv("VITE_VAPID_PUBLIC_KEY"),
} as const;

export const buildSupabaseStoragePublicUrl = (bucket: string, path: string): string =>
  `${ENV.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
