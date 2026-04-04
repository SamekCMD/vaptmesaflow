import { createClient } from "@supabase/supabase-js";

// Reads from Build Secrets (Workspace Settings → Build Secrets)
// These override the auto-generated Cloud .env values
const EXT_URL = import.meta.env.VITE_EXT_SUPABASE_URL as string;
const EXT_KEY = import.meta.env.VITE_EXT_SUPABASE_ANON_KEY as string;

if (!EXT_URL || !EXT_KEY) {
  console.warn(
    "[Vapt] VITE_EXT_SUPABASE_URL or VITE_EXT_SUPABASE_ANON_KEY not set. " +
    "Add them as Build Secrets in Workspace Settings."
  );
}

export const supabase = createClient(EXT_URL, EXT_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "vapt-auth-v1",
  },
});
