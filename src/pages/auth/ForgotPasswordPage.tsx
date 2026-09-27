import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import { z } from "zod";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { ENV } from "@/lib/env";

const emailSchema = z.string().trim().email("Email inválido").max(255);

const ForgotPasswordPage = () => {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Email inválido");
      return;
    }

    setError(null);
    setLoading(true);
    const result = await sendPasswordReset(parsed.data, captchaToken ?? undefined);
    setLoading(false);
    if (ENV.turnstileEnabled) {
      setCaptchaToken(null);
      setCaptchaResetKey((value) => value + 1);
    }
    if (result.error) {
      setError("Não foi possível enviar as instruções. Tente novamente.");
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <MailCheck className="mx-auto mb-2 h-8 w-8 text-primary" aria-hidden="true" />
            <CardTitle className="text-xl font-semibold">Confira seu email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-muted-foreground" role="status">
              Se existir uma conta para esse endereço, enviaremos um link para redefinir a senha.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Voltar para o login</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold">Recuperar senha</CardTitle>
          <CardDescription>
            Informe seu email para receber as próximas instruções.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            {ENV.turnstileEnabled && (
              <TurnstileWidget
                action="password-reset"
                onTokenChange={setCaptchaToken}
                resetKey={captchaResetKey}
              />
            )}
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button
              type="submit"
              className="w-full"
              disabled={loading || (ENV.turnstileEnabled && !captchaToken)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar link
            </Button>
            <Link to="/login" className="text-sm text-primary hover:underline">
              Voltar para o login
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
