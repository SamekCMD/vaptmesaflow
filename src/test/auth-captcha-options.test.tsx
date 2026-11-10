import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  refetch: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  signInEmail: vi.fn(),
  signOut: vi.fn(),
  signUpEmail: vi.fn(),
  updateUser: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    changePassword: mocks.changePassword,
    requestPasswordReset: mocks.requestPasswordReset,
    resetPassword: mocks.resetPassword,
    signIn: { email: mocks.signInEmail },
    signOut: mocks.signOut,
    signUp: { email: mocks.signUpEmail },
    updateUser: mocks.updateUser,
    useSession: mocks.useSession,
  },
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("captcha no contrato do Better Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSession.mockReturnValue({
      data: null,
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: mocks.refetch,
    });
    mocks.signUpEmail.mockResolvedValue({ data: {}, error: null });
    mocks.signInEmail.mockResolvedValue({ data: {}, error: null });
  });

  it("envia o token do Turnstile no cabeçalho ao cadastrar", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signUp(
        "gestor@vapt.test",
        "senha-segura",
        "Gestor Vapt",
        "turnstile-signup-token",
      );
    });

    expect(mocks.signUpEmail).toHaveBeenCalledWith({
      callbackURL: `${window.location.origin}/login?verified=1`,
      email: "gestor@vapt.test",
      fetchOptions: {
        headers: { "x-captcha-response": "turnstile-signup-token" },
      },
      name: "Gestor Vapt",
      password: "senha-segura",
    });
  });

  it("envia o token do Turnstile no cabeçalho ao entrar", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signIn(
        "gestor@vapt.test",
        "senha-segura",
        "turnstile-login-token",
      );
    });

    expect(mocks.signInEmail).toHaveBeenCalledWith({
      email: "gestor@vapt.test",
      fetchOptions: {
        headers: { "x-captcha-response": "turnstile-login-token" },
      },
      password: "senha-segura",
    });
  });
});
