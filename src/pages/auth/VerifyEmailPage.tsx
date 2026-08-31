import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/features/auth/TurnstileWidget";
import { mapAuthError } from "@/features/auth/auth-errors";
import {
  authService,
  clearPendingSignupEmail,
  getPendingSignupEmail,
} from "@/features/auth/auth-service";
import { ENV } from "@/lib/env";

const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const [email] = useState(getPendingSignupEmail);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || token.trim().length < 6 || loading || resending) return;

    setError("");
    setLoading(true);
    try {
      const { data, error: verifyError } = await authService.verifySignupOtp(email, token);
      if (verifyError) {
        setError("Código inválido ou expirado. Confira o email ou solicite outro código.");
        return;
      }
      if (!data.session) {
        setError("Não foi possível iniciar sua sessão. Tente verificar novamente.");
        return;
      }

      clearPendingSignupEmail();
      navigate("/onboarding", { replace: true });
    } catch {
      setError("Não foi possível verificar o código. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (
      !email ||
      countdown > 0 ||
      loading ||
      resending ||
      (ENV.turnstileEnabled && !captchaToken)
    ) return;

    setError("");
    setResending(true);
    try {
      const { error: resendError } = await authService.resendSignupOtp(email, captchaToken ?? "");
      if (resendError) {
        setError(mapAuthError(resendError, "Não foi possível reenviar o código."));
        return;
      }
      setCountdown(60);
    } catch (resendError) {
      setError(mapAuthError(resendError, "Não foi possível reenviar o código."));
    } finally {
      setCaptchaToken(null);
      setCaptchaResetKey((key) => key + 1);
      setResending(false);
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Cadastro não encontrado</CardTitle>
            <CardDescription>Volte ao cadastro para solicitar um novo código.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full"><Link to="/signup">Voltar ao cadastro</Link></Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <MailCheck className="mx-auto h-9 w-9 text-primary" />
          <CardTitle>Verifique seu email</CardTitle>
          <CardDescription>Digite o código enviado para {email}</CardDescription>
        </CardHeader>
        <form onSubmit={verify}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verificationCode">Código de confirmação</Label>
              <Input
                id="verificationCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                value={token}
                onChange={(event) => setToken(event.target.value.replace(/\s/g, ""))}
                placeholder="000000"
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {ENV.turnstileEnabled && (
              <TurnstileWidget action="signup" onToken={setCaptchaToken} resetKey={captchaResetKey} />
            )}
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading || resending || token.trim().length < 6}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar email
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => void resend()}
              disabled={loading || resending || countdown > 0 || (ENV.turnstileEnabled && !captchaToken)}
            >
              {resending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {countdown > 0 ? `Reenviar em ${countdown}s` : "Reenviar código"}
            </Button>
            <Link
              to="/signup"
              onClick={clearPendingSignupEmail}
              className="text-sm text-muted-foreground hover:underline"
            >
              Usar outro email
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default VerifyEmailPage;
