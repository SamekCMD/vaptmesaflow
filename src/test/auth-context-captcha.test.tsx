import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

const AuthProbe = () => {
  const { clearRecoveryMode, recoveryMode, signIn, signUp } = useAuth();

  return (
    <>
      <button
        type="button"
        onClick={() => void signIn("owner@vapt.test", "password", "captcha-token")}
      >
        Sign in
      </button>
      <span>{recoveryMode ? "Recovery active" : "Recovery inactive"}</span>
      <button type="button" onClick={clearRecoveryMode}>Clear recovery</button>
      <button
        type="button"
        onClick={() =>
          void signUp("owner@vapt.test", "password", "Owner", "captcha-token")
        }
      >
        Sign up
      </button>
    </>
  );
};

describe("AuthProvider captcha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { id: "sub", callback: vi.fn(), unsubscribe: vi.fn() } },
    });
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
  });

  it("passes captchaToken to password sign in", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "owner@vapt.test",
        password: "password",
        options: { captchaToken: "captcha-token" },
      }),
    );
  });

  it("passes captchaToken to sign up", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() =>
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: "owner@vapt.test",
        password: "password",
        options: {
          captchaToken: "captcha-token",
          data: { full_name: "Owner" },
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      }),
    );
  });

  it("tracks PASSWORD_RECOVERY until the flow explicitly clears it", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(supabase.auth.onAuthStateChange).toHaveBeenCalled());
    const callback = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0];

    act(() => {
      callback("PASSWORD_RECOVERY", { user: { id: "recovery-user" } } as never);
    });
    expect(screen.getByText("Recovery active")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear recovery" }));
    expect(screen.getByText("Recovery inactive")).toBeInTheDocument();
  });
});
