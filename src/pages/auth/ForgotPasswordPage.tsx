import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/features/auth/TurnstileWidget";
import {
  RECOVERY_SUCCESS_MESSAGE,
  RECOVERY_OPERATIONAL_ERROR,
  mapRecoveryRequestError,
} from "@/features/auth/auth-errors";
import { authService, normalizeAuthEmail } from "@/features/auth/auth-service";
import { ENV } from "@/lib/env";

const emailSchema = z.string().trim().email("Email inválido").max(255);

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0].message);
      setIsSuccess(false);
      return;
    }
    if (ENV.turnstileEnabled && !captchaToken) return;

    setMessage("");
    setLoading(true);
    try {
      const { error } = await authService.requestPasswordReset(
        normalizeAuthEmail(parsed.data),
        captchaToken ?? "",
      );
      const resultMessage = error
        ? mapRecoveryRequestError(error)
        : RECOVERY_SUCCESS_MESSAGE;
      setMessage(resultMessage);
      setIsSuccess(resultMessage === RECOVERY_SUCCESS_MESSAGE);
    } catch (error) {
      setMessage(RECOVERY_OPERATIONAL_ERROR);
      setIsSuccess(false);
    } finally {
      setCaptchaToken(null);
      setCaptchaResetKey((key) => key + 1);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Mail className="mx-auto h-9 w-9 text-primary" />
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>Enviaremos instruções para o email informado</CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {ENV.turnstileEnabled && (
              <TurnstileWidget action="recovery" onToken={setCaptchaToken} resetKey={captchaResetKey} />
            )}
            {message && (
              <p role={isSuccess ? "status" : "alert"} className={isSuccess ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
                {message}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading || (ENV.turnstileEnabled && !captchaToken)}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar instruções
            </Button>
            <Link to="/login" className="text-sm text-muted-foreground hover:underline">Voltar ao login</Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
