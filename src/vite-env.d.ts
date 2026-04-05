/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_EXT_SUPABASE_URL: string;
  readonly VITE_EXT_SUPABASE_ANON_KEY: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_STRIPE_PRICE_STARTER: string;
  readonly VITE_STRIPE_PRICE_PRO: string;
  readonly VITE_STRIPE_PRICE_BUSINESS: string;
  readonly VITE_N8N_WEBHOOK_BASE_URL: string;
  readonly VITE_VAPT_APP_ENDPOINT_SECRET: string;
  readonly VITE_VAPT_WEBHOOK_SETUP_SECRET: string;
  readonly VITE_VAPT_ADMIN_ENDPOINT_SECRET: string;
  readonly VITE_VAPID_PUBLIC_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
