import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";

const authMocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  clearRecoveryMode: vi.fn(),
  signOut: vi.fn(),
  recoveryMode: true,
}));

vi.mock("@/features/auth/auth-service", () => ({
  authService: {
    requestPasswordReset: authMocks.requestPasswordReset,
    updatePassword: authMocks.updatePassword,
  },
  normalizeAuthEmail: (email: string) => email.trim().toLowerCase(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    clearRecoveryMode: authMocks.clearRecoveryMode,
    loading: false,
    recoveryMode: authMocks.recoveryMode,
    signOut: authMocks.signOut,
  }),
}));

vi.mock("@/features/auth/TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken("captcha-token")}>
      Concluir desafio
    </button>
  ),
}));

const renderForgot = () => render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);

const LoginDestination = () => {
  const location = useLocation();
  return <div>{location.state?.passwordReset ? "Login após recuperação" : "Login"}</div>;
};

const renderReset = () =>
  render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/dashboard" element={<div>Bootstrap da conta</div>} />
        <Route path="/login" element={<LoginDestination />} />
      </Routes>
    </MemoryRouter>,
  );

describe("password recovery flow", () => {
  beforeEach(() => {
    authMocks.requestPasswordReset.mockReset();
    authMocks.updatePassword.mockReset();
    authMocks.clearRecoveryMode.mockReset();
    authMocks.signOut.mockReset();
    authMocks.recoveryMode = true;
  });

  it("shows generic success even when the requested account is unknown", async () => {
    authMocks.requestPasswordReset.mockResolvedValue({
      error: Object.assign(new Error("user not found"), { code: "user_not_found" }),
    });
    renderForgot();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "unknown@vapt.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Concluir desafio" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar instruções" }));

    expect(await screen.findByText("Se existir uma conta para este email, você receberá as instruções de recuperação.")).toBeInTheDocument();
    expect(authMocks.requestPasswordReset).toHaveBeenCalledWith(
      "unknown@vapt.test",
      "captcha-token",
    );
  });

  it("shows retry guidance for a rate-limited recovery request", async () => {
    authMocks.requestPasswordReset.mockResolvedValue({
      error: Object.assign(new Error("rate limited"), { status: 429 }),
    });
    renderForgot();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@vapt.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Concluir desafio" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar instruções" }));

    expect(await screen.findByText("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.")).toBeInTheDocument();
  });

  it("does not mask an operational failure as a successful email send", async () => {
    authMocks.requestPasswordReset.mockRejectedValue(new Error("network unavailable"));
    renderForgot();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@vapt.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Concluir desafio" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar instruções" }));

    expect(await screen.findByText("Não foi possível enviar as instruções agora. Tente novamente mais tarde.")).toBeInTheDocument();
  });

  it("rejects an invalid recovery session", () => {
    authMocks.recoveryMode = false;
    renderReset();

    expect(screen.getByText("Link inválido ou expirado")).toBeInTheDocument();
  });

  it("validates password confirmation before updating", () => {
    renderReset();
    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "new-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    expect(screen.getByText("Senhas não conferem")).toBeInTheDocument();
    expect(authMocks.updatePassword).not.toHaveBeenCalled();
  });

  it("updates the password and waits for logout before returning to login", async () => {
    authMocks.updatePassword.mockResolvedValue({ error: null });
    let completeLogout!: () => void;
    authMocks.signOut.mockReturnValue(new Promise<void>((resolve) => { completeLogout = resolve; }));
    renderReset();
    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "new-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "new-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));

    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledOnce());
    expect(screen.queryByText("Login após recuperação")).not.toBeInTheDocument();
    expect(screen.queryByText("Bootstrap da conta")).not.toBeInTheDocument();
    completeLogout();
    expect(await screen.findByText("Login após recuperação")).toBeInTheDocument();
    expect(authMocks.updatePassword).toHaveBeenCalledWith("new-password-123");
  });

  it("retries only logout when session revocation fails after a password change", async () => {
    authMocks.updatePassword.mockResolvedValue({ error: null });
    authMocks.signOut.mockRejectedValueOnce(new Error("network failure")).mockResolvedValueOnce(undefined);
    renderReset();
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "new-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sua senha foi alterada");
    expect(authMocks.clearRecoveryMode).not.toHaveBeenCalled();
    expect(screen.queryByText("Bootstrap da conta")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar encerrar sessões novamente" }));
    expect(await screen.findByText("Login após recuperação")).toBeInTheDocument();
    expect(authMocks.updatePassword).toHaveBeenCalledOnce();
    expect(authMocks.signOut).toHaveBeenCalledTimes(2);
  });

  it("keeps recovery active when password update fails", async () => {
    authMocks.updatePassword.mockResolvedValue({ error: new Error("update failed") });
    renderReset();
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "new-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Atualizar senha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível atualizar");
    expect(authMocks.signOut).not.toHaveBeenCalled();
  });
});
