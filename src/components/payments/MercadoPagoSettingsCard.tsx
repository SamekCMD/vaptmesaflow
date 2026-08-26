import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  paymentConnectionClient,
  type MercadoPagoConnectionStatus,
  type PaymentEnvironment,
} from "@/lib/payment-client";

type ConnectionView = "loading" | "connected" | "disconnected" | "error";

type MercadoPagoSettingsCardProps = {
  restaurantId: string;
  environment: PaymentEnvironment;
  onAuthorizationUrl?: (url: string) => void;
};

function parseAuthorizationUrl(value: string): string {
  const url = new URL(value);
  const allowedHost =
    url.hostname === "auth.mercadopago.com" ||
    url.hostname === "auth.mercadopago.com.br";

  if (url.protocol !== "https:" || !allowedHost) {
    throw new Error("invalid_authorization_url");
  }

  return url.toString();
}

function getConnectionView(status: MercadoPagoConnectionStatus): ConnectionView {
  return status.connected && status.status === "active" ? "connected" : "disconnected";
}

export default function MercadoPagoSettingsCard({
  restaurantId,
  environment,
  onAuthorizationUrl = (url) => window.location.assign(url),
}: MercadoPagoSettingsCardProps) {
  const [view, setView] = useState<ConnectionView>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setView("loading");
    setActionMessage(null);

    paymentConnectionClient
      .getMercadoPagoStatus(restaurantId, environment)
      .then((status) => {
        if (active) setView(getConnectionView(status));
      })
      .catch(() => {
        if (active) setView("error");
      });

    return () => {
      active = false;
    };
  }, [environment, reloadKey, restaurantId]);

  const handleConnect = async () => {
    setConnecting(true);
    setActionMessage(null);
    try {
      const result = await paymentConnectionClient.connectMercadoPago(
        restaurantId,
        environment,
        window.location.origin,
      );
      onAuthorizationUrl(parseAuthorizationUrl(result.authorizationUrl));
    } catch {
      setActionMessage("Não foi possível iniciar a conexão");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setActionMessage(null);
    try {
      await paymentConnectionClient.disconnectMercadoPago(restaurantId, environment);
      setView("disconnected");
      setActionMessage("Mercado Pago desconectado");
    } catch {
      setActionMessage("Não foi possível desconectar agora. Tente novamente.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base">Conectar Mercado Pago</CardTitle>
              <CardDescription>
                Aceite pagamentos online e atualize seus pedidos automaticamente.
              </CardDescription>
            </div>
          </div>
          {view === "connected" && <Badge>Ativo</Badge>}
        </div>
      </CardHeader>

      <CardContent>
        {view === "loading" && (
          <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Verificando conexão...
          </div>
        )}

        {view === "error" && (
          <div className="flex min-h-36 flex-col items-start justify-center gap-3 border-t border-border py-5">
            <div className="space-y-1">
              <p className="font-medium">Não foi possível verificar a conexão</p>
              <p className="text-sm text-muted-foreground">
                Seus dados continuam seguros. Tente consultar novamente em alguns instantes.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setReloadKey((value) => value + 1)}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        )}

        {view === "disconnected" && (
          <div className="grid gap-5 border-t border-border py-5 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-2">
              <p className="font-medium">Receba pagamentos online com Mercado Pago</p>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                O cliente paga no ambiente seguro do Mercado Pago e o Vapt confirma o pedido automaticamente.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                Suas credenciais não ficam expostas no navegador.
              </div>
            </div>
            <Button type="button" onClick={handleConnect} disabled={connecting} className="w-full md:w-auto">
              {connecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {connecting ? "Abrindo Mercado Pago..." : "Conectar Mercado Pago"}
            </Button>
          </div>
        )}

        {view === "connected" && (
          <div className="grid gap-5 border-t border-border py-5 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-medium">Mercado Pago conectado</p>
                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Os pagamentos online já podem ser recebidos e conciliados automaticamente.
                </p>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" className="w-full md:w-auto">
                  <Unplug className="mr-2 h-4 w-4" aria-hidden="true" />
                  Desconectar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desconectar o Mercado Pago?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Novos pagamentos online ficarão indisponíveis até que uma conta seja conectada novamente.
                    Pedidos e pagamentos anteriores não serão apagados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Manter conectado</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    Desconectar Mercado Pago
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {actionMessage && (
          <p
            className="border-t border-border pt-3 text-sm text-muted-foreground"
            role={actionMessage.includes("Não foi possível") ? "alert" : "status"}
          >
            {actionMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
