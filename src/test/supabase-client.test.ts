import { describe, expect, it } from "vitest";

import { supabase as canonicalSupabase } from "@/lib/supabase";
import { supabase as generatedSupabase } from "@/integrations/supabase/client";

describe("supabase client convergence", () => {
  it("re-exports the canonical client from the generated integration path", () => {
    expect(generatedSupabase).toBe(canonicalSupabase);
  });
});
