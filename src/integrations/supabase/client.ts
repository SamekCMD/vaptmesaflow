import { createClient } from "@supabase/supabase-js";
import { ENV } from "@/lib/env";

export const supabase = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'vapt-auth-v1',
  },
});
