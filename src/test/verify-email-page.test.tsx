import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VerifyEmailPage from "@/pages/auth/VerifyEmailPage";

const authMocks = vi.hoisted(() => ({
  verifySignupOtp: vi.fn(),
  resendSignupOtp: vi.fn(),
  clearPendingSignupEmail: vi.fn(),
}));

vi.mock("@/features/auth/auth-service", () => ({
  authService: {
    verifySignupOtp: authMocks.verifySignupOtp,
    resendSignupOtp: authMocks.resendSignupOtp,
  },
  clearPendingSignupEmail: authMocks.clearPendingSignupEmail,
  getPendingSignupEmail: () => "owner@vapt.test",
}));

vi.mock("@/features/auth/TurnstileWidget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken("captcha-token")}>
      Concluir desafio
    </button>
  ),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/verify-email"]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/onboarding" element={<div>Onboarding confirmado</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    authMocks.verifySignupOtp.mockReset();
    authMocks.resendSignupOtp.mockReset();
    authMocks.clearPendingSignupEmail.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the user on verification after an invalid or expired code", async () => {
    authMocks.verifySignupOtp.mockResolvedValue({ error: new Error("expired") });
    renderPage();

    fireEvent.change(screen.getByLabelText("Código de confirmação"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar email" }));

    expect(
      await screen.findByText("Código inválido ou expirado. Confira o email ou solicite outro código."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Onboarding confirmado")).not.toBeInTheDocument();
  });

  it("clears pending state and enters onboarding after a valid code", async () => {
    authMocks.verifySignupOtp.mockResolvedValue({
      data: { session: { access_token: "verified-session" } },
      error: null,
    });
    renderPage();

    fireEvent.change(screen.getByLabelText("Código de confirmação"), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar email" }));

    expect(await screen.findByText("Onboarding confirmado")).toBeInTheDocument();
    expect(authMocks.clearPendingSignupEmail).toHaveBeenCalledOnce();
    expect(authMocks.verifySignupOtp).toHaveBeenCalledWith("owner@vapt.test", "654321");
  });

  it("keeps pending state when verification does not establish a session", async () => {
    authMocks.verifySignupOtp.mockResolvedValue({ data: { session: null }, error: null });
    renderPage();

    fireEvent.change(screen.getByLabelText("Código de confirmação"), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar email" }));

    expect(await screen.findByText("Não foi possível iniciar sua sessão. Tente verificar novamente.")).toBeInTheDocument();
    expect(authMocks.clearPendingSignupEmail).not.toHaveBeenCalled();
    expect(screen.queryByText("Onboarding confirmado")).not.toBeInTheDocument();
  });

  it("allows resend only after the 60-second cooldown and forwards a fresh CAPTCHA", async () => {
    vi.useFakeTimers();
    authMocks.resendSignupOtp.mockResolvedValue({ error: null });
    renderPage();

    expect(screen.getByRole("button", { name: "Reenviar em 60s" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Concluir desafio" }));

    for (let second = 0; second < 60; second += 1) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }

    const resend = screen.getByRole("button", { name: "Reenviar código" });
    expect(resend).toBeEnabled();
    await act(async () => {
      fireEvent.click(resend);
    });

    expect(authMocks.resendSignupOtp).toHaveBeenCalledWith(
      "owner@vapt.test",
      "captcha-token",
    );
  });
});
