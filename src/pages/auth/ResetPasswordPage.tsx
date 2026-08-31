import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/features/auth/auth-service";

const passwordSchema = z.object({
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
  confirmation: z.string(),
}).refine((value) => value.password === value.confirmation, {
  message: "Senhas não conferem",
  path: ["confirmation"],
});

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { clearRecoveryMode, loading: authLoading, recoveryMode, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = passwordSchema.safeParse({ password, confirmation });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setError("");
    setLoading(true);
    try {
      const { error: updateError } = await authService.updatePassword(parsed.data.password);
      if (updateError) {
        setError("Não foi possível atualizar a senha. Solicite um novo link.");
        return;
      }
      clearRecoveryMode();
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Não foi possível atualizar a senha. Solicite um novo link.");
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    clearRecoveryMode();
    await signOut();
    navigate("/login", { replace: true });
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!recoveryMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Link inválido ou expirado</CardTitle>
            <CardDescription>Solicite uma nova recuperação para continuar.</CardDescription>
          </CardHeader>
          <CardFooter><Button asChild className="w-full"><Link to="/forgot-password">Solicitar novo link</Link></Button></CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto h-9 w-9 text-primary" />
          <CardTitle>Definir nova senha</CardTitle>
          <CardDescription>Escolha uma senha com pelo menos 8 caracteres</CardDescription>
        </CardHeader>
        <form onSubmit={submit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmation">Confirmar nova senha</Label>
              <Input id="confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Atualizar senha
            </Button>
            <Button type="button" variant="ghost" onClick={() => void cancel()}>Cancelar</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
