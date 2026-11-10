import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    session: null,
    loading: false,
    signUp: vi.fn(),
    signIn,
    signOut: vi.fn(),
  }),
}));

import LoginPage from "@/pages/auth/LoginPage";

describe("Turnstile no login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn.mockResolvedValue({ error: null });
  });

  it("bloqueia o envio até receber um token e o repassa ao login", async () => {
    let completeChallenge: ((token: string) => void) | undefined;
    const renderTurnstile = vi.fn(
      (_container: HTMLElement, options: { callback: (token: string) => void }) => {
        completeChallenge = options.callback;
        return "widget-id";
      },
    );

    Object.defineProperty(window, "turnstile", {
      configurable: true,
      value: {
        render: renderTurnstile,
        remove: vi.fn(),
        reset: vi.fn(),
      },
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "gestor@vapt.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-segura" },
    });

    const submit = screen.getByRole("button", { name: "Entrar" });
    expect(submit).toBeDisabled();
    expect(signIn).not.toHaveBeenCalled();

    await waitFor(() => expect(renderTurnstile).toHaveBeenCalledTimes(1));
    act(() => completeChallenge?.("turnstile-login-token"));

    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith(
        "gestor@vapt.test",
        "senha-segura",
        "turnstile-login-token",
      );
    });
  });

  it("descarta o token consumido quando o login falha", async () => {
    let completeChallenge: ((token: string) => void) | undefined;
    const resetTurnstile = vi.fn();

    signIn.mockResolvedValue({ error: new Error("Credenciais inválidas") });
    Object.defineProperty(window, "turnstile", {
      configurable: true,
      value: {
        render: vi.fn(
          (_container: HTMLElement, options: { callback: (token: string) => void }) => {
            completeChallenge = options.callback;
            return "widget-id";
          },
        ),
        remove: vi.fn(),
        reset: resetTurnstile,
      },
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "gestor@vapt.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-incorreta" },
    });
    await waitFor(() => expect(completeChallenge).toBeTypeOf("function"));
    act(() => completeChallenge?.("turnstile-consumed-token"));
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(resetTurnstile).toHaveBeenCalledWith("widget-id");
      expect(screen.getByRole("button", { name: "Entrar" })).toBeDisabled();
    });
  });
});
