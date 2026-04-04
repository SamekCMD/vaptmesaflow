import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ENV } from "@/lib/env";

// Fonte única para o cliente Supabase. Suporta o fluxo externo do Lovable,
// o fluxo padrão do Vite e os fallbacks públicos do frontend.
export const supabase = createClient<Database>(ENV.supabaseUrl, ENV.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "vapt-auth-v1",
  },
});
