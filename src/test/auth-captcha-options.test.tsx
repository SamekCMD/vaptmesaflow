import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signUp, signInWithPassword } = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signUp,
      signInWithPassword,
      signOut: vi.fn(),
    },
  },
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("captcha no contrato de autenticação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signUp.mockResolvedValue({ error: null });
    signInWithPassword.mockResolvedValue({ error: null });
  });

  it("envia o token do Turnstile ao cadastrar", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signUp(
        "gestor@vapt.test",
        "senha-segura",
        "Gestor Vapt",
        "turnstile-signup-token",
      );
    });

    expect(signUp).toHaveBeenCalledWith({
      email: "gestor@vapt.test",
      password: "senha-segura",
      options: {
        captchaToken: "turnstile-signup-token",
        data: { full_name: "Gestor Vapt" },
        emailRedirectTo: window.location.origin,
      },
    });
  });

  it("envia o token do Turnstile ao entrar", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signIn(
        "gestor@vapt.test",
        "senha-segura",
        "turnstile-login-token",
      );
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "gestor@vapt.test",
      password: "senha-segura",
      options: { captchaToken: "turnstile-login-token" },
    });
  });
});
