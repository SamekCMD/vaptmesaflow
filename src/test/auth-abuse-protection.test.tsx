import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/pages/auth/LoginPage";

const authState = vi.hoisted(() => ({
  user: null,
  loading: false,
  signIn: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/features/auth/TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (token: string | null) => void }) => (
    <button type="button" onClick={() => onToken("turnstile-test-token")}>
      Concluir desafio
    </button>
  ),
}));

describe("auth abuse protection", () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = false;
    authState.signIn.mockReset();
  });

  it("shows retry guidance for a rate-limited login without replaying it", async () => {
    authState.signIn.mockResolvedValue({
      error: Object.assign(new Error("rate limit exceeded"), { status: 429 }),
    });

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

    expect(
      await screen.findByText("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente."),
    ).toBeInTheDocument();
    await waitFor(() => expect(authState.signIn).toHaveBeenCalledOnce());
  });
});
