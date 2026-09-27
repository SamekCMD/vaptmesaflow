import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const VerifyEmailPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-background px-4">
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <MailCheck className="mx-auto mb-2 h-8 w-8 text-primary" aria-hidden="true" />
        <CardTitle className="text-xl font-semibold">Verifique seu email</CardTitle>
        <CardDescription>
          Enviamos as próximas instruções para o endereço informado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-center text-sm text-muted-foreground">
          Se o endereço informado puder receber mensagens, o email chegará em instantes.
          Confira também a pasta de spam.
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

export default VerifyEmailPage;
