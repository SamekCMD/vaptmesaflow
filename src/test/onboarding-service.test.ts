import { beforeEach, describe, expect, it, vi } from "vitest";

import { supabase } from "@/lib/supabase";
import { saveOnboardingDraft } from "@/features/onboarding/onboarding-service";

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: vi.fn() },
}));

describe("onboarding draft service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends no browser timestamp and reuses the known restaurant id", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{
        id: "rest-1", organization_id: "org-1", name: "Vapt Burger",
        slug: "vapt-burger", whatsapp: null, primary_color: "#0ea573",
        secondary_color: "#1e293b", total_tables: 10, onboarding_step: 1,
        local_enabled: true, delivery_enabled: true,
      }],
      error: null,
    } as never);

    await saveOnboardingDraft({
      restaurantId: "rest-1", organizationId: "org-1", name: "Vapt Burger",
      slug: "vapt-burger", whatsapp: "", primaryColor: "#0ea573",
      secondaryColor: "#1e293b", totalTables: 10, onboardingStep: 1,
      localEnabled: true, deliveryEnabled: true,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("save_onboarding_draft", {
      p_name: "Vapt Burger",
      p_slug: "vapt-burger",
      p_onboarding_step: 1,
      p_restaurant_id: "rest-1",
      p_organization_id: "org-1",
      p_whatsapp: null,
      p_primary_color: "#0ea573",
      p_secondary_color: "#1e293b",
      p_total_tables: 10,
      p_local_enabled: true,
      p_delivery_enabled: true,
    });
    expect(vi.mocked(supabase.rpc).mock.calls[0][1]).not.toHaveProperty("onboarding_updated_at");
  });
});
