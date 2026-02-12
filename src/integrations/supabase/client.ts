import { createClient } from "@supabase/supabase-js";

// These are stored as Lovable secrets (EXT_SUPABASE_URL, EXT_SUPABASE_ANON_KEY)
// For the client-side, we need the values directly.
// In production, these would come from environment variables.
// TODO: Replace with your actual Supabase URL and anon key
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "Supabase credentials not found. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
