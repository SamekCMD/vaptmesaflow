const readEnv = (key: string, fallback = ""): string => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
};

const isTest = import.meta.env.MODE === "test";

const readPaymentEnvironment = (): "sandbox" | "production" =>
  readEnv("VITE_PAYMENT_ENVIRONMENT") === "sandbox" ? "sandbox" : "production";

const turnstileEnabled = readEnv("VITE_TURNSTILE_ENABLED") === "true";

const readMenuImageStorageMode = (): "disabled" | "r2" =>
  readEnv("VITE_MENU_IMAGE_STORAGE_MODE") === "r2" ? "r2" : "disabled";

const readRequiredEnv = (key: string): string => {
  const value = readEnv(key);
  if (value) return value;

  if (isTest) {
    return `__${key.toLowerCase()}__`;
  }

  throw new Error(`[ENV] Missing required variable: ${key}`);
};

export const ENV = {
  stripePublishableKey: readRequiredEnv("VITE_STRIPE_PUBLISHABLE_KEY"),
  vaptApiBaseUrl: readRequiredEnv("VITE_VAPT_API_BASE_URL"),
  paymentEnvironment: readPaymentEnvironment(),
  vapidPublicKey: readEnv("VITE_VAPID_PUBLIC_KEY"),
  turnstileEnabled,
  menuImageStorageMode: readMenuImageStorageMode(),
  turnstileSiteKey: turnstileEnabled
    ? readRequiredEnv("VITE_TURNSTILE_SITE_KEY")
    : readEnv("VITE_TURNSTILE_SITE_KEY"),
} as const;
