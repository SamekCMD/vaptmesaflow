import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  changePassword: vi.fn(),
  resetPassword: vi.fn(),
  sendPasswordReset: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  updateName: vi.fn(),
  user: null as { id: string; email: string; name: string } | null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    changePassword: auth.changePassword,
    loading: false,
    resetPassword: auth.resetPassword,
    sendPasswordReset: auth.sendPasswordReset,
    session: null,
    signIn: auth.signIn,
    signOut: auth.signOut,
    signUp: auth.signUp,
    updateName: auth.updateName,
    user: auth.user,
  }),
}));

vi.mock("@/components/auth/TurnstileWidget", () => ({
  default: ({
    onTokenChange,
    resetKey = 0,
  }: {
    onTokenChange: (token: string) => void;
    resetKey?: number;
  }) => (
    <button
      type="button"
      data-reset-key={resetKey}
      onClick={() => onTokenChange("turnstile-flow-token")}
    >
      Resolver verificação
    </button>
  ),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    isActive: true,
    isTrialing: false,
    loading: false,
    planType: "starter",
    trialDaysLeft: 0,
  }),
}));

vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("@/components/dashboard/TrialBanner", () => ({ default: () => null }));
vi.mock("@/components/dashboard/PushNotificationBanner", () => ({ default: () => null }));
vi.mock("@/lib/push-notifications", () => ({ registerServiceWorker: vi.fn() }));
vi.mock("@/lib/restaurants", () => ({
  fetchOwnedRestaurant: vi.fn().mockResolvedValue(null),
}));

import DashboardLayout from "@/components/DashboardLayout";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import LoginPage from "@/pages/auth/LoginPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import SignupPage from "@/pages/auth/SignupPage";
import VerifyEmailPage from "@/pages/auth/VerifyEmailPage";

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const solveCaptcha = () => {
  fireEvent.click(screen.getByRole("button", { name: "Resolver verificação" }));
};

describe("fluxos de conta do Better Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = null;
    auth.signUp.mockResolvedValue({ error: null });
    auth.signIn.mockResolvedValue({ error: null });
    auth.sendPasswordReset.mockResolvedValue({ error: null });
    auth.resetPassword.mockResolvedValue({ error: null });
  });

  it("leva o cadastro concluído à instrução de verificação, nunca ao onboarding", async () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/verify-email"
            element={
              <>
                <VerifyEmailPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Nome Completo"), {
      target: { value: "Gestor Vapt" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "gestor@vapt.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-segura" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar Senha"), {
      target: { value: "senha-segura" },
    });
    solveCaptcha();
    fireEvent.click(screen.getByRole("button", { name: "Criar Conta" }));

    expect(await screen.findByTestId("location")).toHaveTextContent("/verify-email");
    expect(screen.queryByText("/onboarding")).not.toBeInTheDocument();
  });

  it("explica o email de verificação sem revelar se uma conta existe", () => {
    render(
      <MemoryRouter>
        <VerifyEmailPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /verifique seu email/i })).toBeInTheDocument();
    expect(screen.getByText(/se o endereço informado puder receber mensagens/i)).toBeInTheDocument();
    expect(screen.queryByText("gestor@vapt.test")).not.toBeInTheDocument();
  });

  it("confirma a verificação no login e trata 403 sem detalhar credenciais", async () => {
    auth.signIn.mockResolvedValue({
      error: Object.assign(new Error("detalhe interno"), {
        code: "EMAIL_NOT_VERIFIED",
        status: 403,
      }),
    });
    render(
      <MemoryRouter initialEntries={["/login?verified=1"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/email confirmado/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "gestor@vapt.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-segura" },
    });
    solveCaptcha();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText(/verifique seu email/i)).toBeInTheDocument();
    expect(screen.queryByText(/detalhe interno/i)).not.toBeInTheDocument();
  });

  it("não confunde falha 403 do CAPTCHA com email não verificado", async () => {
    auth.signIn.mockResolvedValue({
      error: Object.assign(new Error("Captcha verification failed"), {
        code: "VERIFICATION_FAILED",
        status: 403,
      }),
    });
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "gestor@vapt.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-segura" },
    });
    solveCaptcha();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Email ou senha incorretos")).toBeInTheDocument();
    expect(screen.queryByText(/verifique seu email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/captcha verification failed/i)).not.toBeInTheDocument();
  });

  it("protege a recuperação com Turnstile e sempre mostra a mesma confirmação", async () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "gestor@vapt.test" },
    });
    expect(screen.getByRole("button", { name: /enviar link/i })).toBeDisabled();
    solveCaptcha();
    fireEvent.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => {
      expect(auth.sendPasswordReset).toHaveBeenCalledWith(
        "gestor@vapt.test",
        "turnstile-flow-token",
      );
    });
    expect(screen.getByText(/se existir uma conta para esse endereço/i)).toBeInTheDocument();
  });

  it("mantém a recuperação disponível e renova o Turnstile após falha operacional", async () => {
    auth.sendPasswordReset.mockResolvedValue({
      error: Object.assign(new Error("detalhe interno"), {
        code: "VERIFICATION_FAILED",
        status: 403,
      }),
    });
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "gestor@vapt.test" },
    });
    const captcha = screen.getByRole("button", { name: "Resolver verificação" });
    expect(captcha).toHaveAttribute("data-reset-key", "0");
    solveCaptcha();
    fireEvent.click(screen.getByRole("button", { name: /enviar link/i }));

    expect(await screen.findByText(/não foi possível enviar as instruções/i)).toBeInTheDocument();
    expect(screen.queryByText(/se existir uma conta para esse endereço/i)).not.toBeInTheDocument();
    expect(captcha).toHaveAttribute("data-reset-key", "1");
  });

  it("rejeita link sem token e redefine a senha com um token válido", async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/link de redefinição inválido/i)).toBeInTheDocument();
    expect(auth.resetPassword).not.toHaveBeenCalled();
    unmount();

    render(
      <MemoryRouter initialEntries={["/reset-password?token=reset-token"]}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "nova-senha-segura" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), {
      target: { value: "nova-senha-segura" },
    });
    fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(auth.resetPassword).toHaveBeenCalledWith(
        "reset-token",
        "nova-senha-segura",
      );
    });
  });

  it("mostra o nome normalizado do Better Auth no dashboard", async () => {
    auth.user = {
      id: "user-1",
      email: "gestor@vapt.test",
      name: "Gestor Better Auth",
    };
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<div>Conteúdo</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Gestor Better Auth")).toBeInTheDocument();
  });
});
