import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const appearanceMocks = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/features/restaurants/current-restaurant", () => ({
  useCurrentRestaurant: () => ({
    restaurantId: "rest-1",
    restaurant: {
      id: "rest-1",
      organizationId: "org-1",
      name: "Vapt Burger",
      slug: "vapt-burger",
      onboardingStatus: "complete",
    },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: appearanceMocks.toast,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: appearanceMocks.from,
    storage: {
      from: vi.fn(() => ({
        upload: appearanceMocks.upload,
        remove: appearanceMocks.remove,
      })),
    },
  },
}));

import AppearancePage from "@/pages/dashboard/AppearancePage";

describe("appearance logo upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:logo-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    appearanceMocks.updateEq.mockResolvedValue({ error: null });
    appearanceMocks.update.mockReturnValue({ eq: appearanceMocks.updateEq });
    appearanceMocks.from.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "rest-1",
              name: "Vapt Burger",
              slug: "vapt-burger",
              logo_url: "https://supabase.test.example.com/storage/v1/object/public/restaurant-assets/organizations/org-1/restaurants/rest-1/branding/old.png",
              primary_color: "#0ea573",
              secondary_color: "#1e293b",
              font_family: "modern",
              delivery_enabled: false,
            },
            error: null,
          }),
        })),
      })),
      update: appearanceMocks.update,
    }));
    appearanceMocks.upload.mockResolvedValue({
      data: null,
      error: { message: "storage unavailable" },
    });
    appearanceMocks.remove.mockResolvedValue({ data: null, error: null });
  });

  it("does not overwrite persisted branding when storage upload fails", async () => {
    const { container } = render(<AppearancePage />);

    expect(await screen.findByDisplayValue("Vapt Burger")).toBeInTheDocument();
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput!, {
      target: {
        files: [new File(["logo"], "logo.png", { type: "image/png" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /salvar altera/i }));

    await waitFor(() => expect(appearanceMocks.upload).toHaveBeenCalledTimes(1));
    expect(appearanceMocks.update).not.toHaveBeenCalled();
    expect(appearanceMocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Erro ao salvar",
      variant: "destructive",
    }));
  });
});
