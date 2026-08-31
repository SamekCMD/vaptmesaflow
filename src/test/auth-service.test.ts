import { beforeEach, describe, expect, it, vi } from "vitest";

import { authService } from "@/features/auth/auth-service";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      verifyOtp: vi.fn(),
      resend: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes signup verification payload", async () => {
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({ data: {}, error: null });

    await authService.verifySignupOtp(" OWNER@VAPT.TEST ", " 123456 ");

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: "owner@vapt.test",
      token: "123456",
      type: "signup",
    });
  });

  it("forwards CAPTCHA in the normalized signup resend payload", async () => {
    vi.mocked(supabase.auth.resend).mockResolvedValue({ data: {}, error: null });

    await authService.resendSignupOtp(" OWNER@VAPT.TEST ", "captcha-token");

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "owner@vapt.test",
      options: {
        captchaToken: "captcha-token",
        emailRedirectTo: window.location.origin,
      },
    });
  });

  it("requests password recovery with normalized email, redirect and CAPTCHA", async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ data: {}, error: null });

    await authService.requestPasswordReset(" OWNER@VAPT.TEST ", "captcha-token");

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "owner@vapt.test",
      {
        captchaToken: "captcha-token",
        redirectTo: `${window.location.origin}/reset-password`,
      },
    );
  });

  it("updates the authenticated recovery user's password", async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({ data: { user: null }, error: null });

    await authService.updatePassword("new-password-123");

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "new-password-123" });
  });
});
