/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VAPT_API_BASE_URL: string;
  readonly VITE_VAPID_PUBLIC_KEY: string;
  readonly VITE_TURNSTILE_ENABLED: string;
  readonly VITE_TURNSTILE_SITE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
