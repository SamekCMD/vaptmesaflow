import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";
import { mapAuthError } from "@/features/auth/auth-errors";
import { TurnstileWidget } from "@/features/auth/TurnstileWidget";
import { ENV } from "@/lib/env";
import {
  clearPendingSignupEmail,
  normalizeAuthEmail,
  setPendingSignupEmail,
} from "@/features/auth/auth-service";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Nome muito curto").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Senhas não conferem",
  path: ["confirmPassword"],
});

const SignupPage = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = signupSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    if (ENV.turnstileEnabled && !captchaToken) return;
    setLoading(true);
    const handleFailure = (error: unknown) => {
      setErrors({
        email: mapAuthError(error, "Não foi possível criar sua conta. Tente novamente."),
      });
      setCaptchaToken(null);
      setCaptchaResetKey((key) => key + 1);
    };

    try {
      const normalizedEmail = normalizeAuthEmail(form.email);
      const { error, session } = await signUp(
        normalizedEmail,
        form.password,
        form.fullName,
        captchaToken ?? "",
      );
      if (error) {
        handleFailure(error);
        return;
      }
      if (!session) {
        setPendingSignupEmail(normalizedEmail);
        navigate("/verify-email");
        return;
      }

      clearPendingSignupEmail();
      navigate("/onboarding");
    } catch (error) {
      handleFailure(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold">Criar Conta</CardTitle>
          <CardDescription>Comece a gerenciar seu restaurante agora</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input id="fullName" placeholder="João Silva" value={form.fullName} onChange={set("fullName")} autoComplete="name" />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="voce@restaurante.com" value={form.email} onChange={set("email")} autoComplete="email" />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input id="password" type={showPw ? "text" : "password"} placeholder="Mínimo 8 caracteres" value={form.password} onChange={set("password")} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input id="confirmPassword" type="password" placeholder="Repita a senha" value={form.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
            </div>
            {ENV.turnstileEnabled && (
              <TurnstileWidget action="signup" onToken={setCaptchaToken} resetKey={captchaResetKey} />
            )}
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading || (ENV.turnstileEnabled && !captchaToken)}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Conta
            </Button>
            <p className="text-sm text-muted-foreground">
              Já tem conta?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default SignupPage;
