import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";

const authState = vi.hoisted(() => ({
  user: null,
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/features/auth/TurnstileWidget", () => ({
  TurnstileWidget: ({
    onToken,
    resetKey,
  }: {
    onToken: (token: string | null) => void;
    resetKey: number;
  }) => (
    <div>
      <button type="button" onClick={() => onToken("turnstile-test-token")}>
        Concluir desafio
      </button>
      <span data-testid="captcha-reset-key">{resetKey}</span>
    </div>
  ),
}));

describe("auth page CAPTCHA protection", () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = false;
    authState.signIn.mockReset();
    authState.signUp.mockReset();
  });

  it("blocks login until CAPTCHA succeeds and forwards its token", async () => {
    authState.signIn.mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const submit = screen.getByRole("button", { name: "Entrar" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@vapt.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Concluir desafio" }));
    expect(submit).toBeEnabled();

    fireEvent.click(submit);

    await waitFor(() =>
      expect(authState.signIn).toHaveBeenCalledWith(
        "owner@vapt.test",
        "password",
        "turnstile-test-token",
      ),
    );
  });

  it("forwards CAPTCHA on signup and resets it after an auth failure", async () => {
    authState.signUp.mockResolvedValue({ error: new Error("signup failed") });

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Nome Completo"), {
      target: { value: "Vapt Owner" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@vapt.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar Senha"), {
      target: { value: "password123" },
    });

    const submit = screen.getByRole("button", { name: "Criar Conta" });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Concluir desafio" }));
    fireEvent.click(submit);

    await waitFor(() =>
      expect(authState.signUp).toHaveBeenCalledWith(
        "owner@vapt.test",
        "password123",
        "Vapt Owner",
        "turnstile-test-token",
      ),
    );
    await waitFor(() => expect(screen.getByTestId("captcha-reset-key")).toHaveTextContent("1"));
    expect(submit).toBeDisabled();
  });

  it("recovers from an unexpected login rejection and invalidates the token", async () => {
    authState.signIn.mockRejectedValue(new Error("network unavailable"));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@vapt.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Concluir desafio" }));
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Não foi possível entrar. Tente novamente.")).toBeInTheDocument();
    expect(screen.getByTestId("captcha-reset-key")).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDisabled();
  });
});
