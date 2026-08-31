import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignupPage from "@/pages/auth/SignupPage";

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
  signUp: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/features/auth/TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken("captcha-token")}>
      Concluir desafio
    </button>
  ),
}));

const renderSignupRoutes = () =>
  render(
    <MemoryRouter initialEntries={["/signup"]}>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<div>Verifique seu email</div>} />
        <Route path="/onboarding" element={<div>Onboarding</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("signup verification flow", () => {
  beforeEach(() => {
    sessionStorage.clear();
    authState.user = null;
    authState.loading = false;
    authState.signUp.mockReset();
  });

  it("does not redirect merely because auth user becomes truthy", () => {
    authState.user = { id: "user-during-submit" };

    renderSignupRoutes();

    expect(screen.getByRole("heading", { name: "Criar Conta" })).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("routes confirmation-required signup to verify email without persisting password", async () => {
    authState.signUp.mockResolvedValue({ error: null, session: null });
    renderSignupRoutes();

    fireEvent.change(screen.getByLabelText("Nome Completo"), {
      target: { value: "Vapt Owner" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "  OWNER@VAPT.TEST " },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar Senha"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Concluir desafio" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar Conta" }));

    expect(await screen.findByText("Verifique seu email")).toBeInTheDocument();
    expect(sessionStorage.getItem("vapt_pending_signup_email")).toBe("owner@vapt.test");
    await waitFor(() => {
      expect(JSON.stringify(sessionStorage)).not.toContain("password123");
    });
  });
});
