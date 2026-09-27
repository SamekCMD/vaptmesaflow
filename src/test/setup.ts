import "@testing-library/jest-dom";
import { vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.test.example.com");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", "pk_test_vapt");
vi.stubEnv("VITE_VAPT_API_BASE_URL", "https://api.test.example.com");
vi.stubEnv("VITE_TURNSTILE_ENABLED", "true");
vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "test-turnstile-site-key");

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
