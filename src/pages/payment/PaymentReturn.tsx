import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw, SearchX, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { orderClient } from "@/lib/order-client";
import { readPendingCheckout } from "@/lib/payment-client";

type PaymentView = "checking" | "paid" | "failed" | "missing";

const PAID_STATUSES = new Set(["paid", "approved"]);
const FAILED_STATUSES = new Set([
  "failed",
  "cancelled",
  "canceled",
  "rejected",
  "refunded",
  "charged_back",
]);

const states = {
  checking: {
    eyebrow: "CONFIRMAÇÃO SEGURA",
    title: "Confirmando pagamento",
    description: "Recebemos o retorno do Mercado Pago e estamos aguardando a confirmação segura do pedido.",
    Icon: Clock3,
    accent: "text-amber-700 bg-amber-50",
  },
  paid: {
    eyebrow: "PAGAMENTO APROVADO",
    title: "Pagamento confirmado",
    description: "Tudo certo. O pagamento foi confirmado pela API e o pedido já pode seguir para a cozinha.",
    Icon: CheckCircle2,
    accent: "text-[hsl(var(--sage))] bg-[hsl(var(--sage-subtle))]",
  },
  failed: {
    eyebrow: "PAGAMENTO INTERROMPIDO",
    title: "Pagamento não concluído",
    description: "O pagamento não foi aprovado. Volte ao pedido para escolher outra forma ou tentar novamente.",
    Icon: XCircle,
    accent: "text-destructive bg-destructive/10",
  },
  missing: {
    eyebrow: "PEDIDO NÃO IDENTIFICADO",
    title: "Não localizamos este pedido",
    description: "O retorno não corresponde a um checkout iniciado neste navegador. Volte ao cardápio para continuar.",
    Icon: SearchX,
    accent: "text-muted-foreground bg-muted",
  },
} satisfies Record<PaymentView, {
  eyebrow: string;
  title: string;
  description: string;
  Icon: typeof CheckCircle2;
  accent: string;
}>;

function viewForPaymentStatus(status: string | null): PaymentView {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (PAID_STATUSES.has(normalized)) return "paid";
  if (FAILED_STATUSES.has(normalized)) return "failed";
  return "checking";
}

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const [context] = useState(readPendingCheckout);
  const externalReference = searchParams.get("external_reference");
  const contextMatches = context !== null &&
    (externalReference === null || externalReference === context.transactionId);
  const [view, setView] = useState<PaymentView>(contextMatches ? "checking" : "missing");
  const [connectionIssue, setConnectionIssue] = useState(false);

  useEffect(() => {
    if (!contextMatches || !context) return;

    let cancelled = false;
    let timeoutId: number | undefined;
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const order = await orderClient.get(context.orderId, context.publicToken);
        if (cancelled) return;
        setConnectionIssue(false);
        const nextView = viewForPaymentStatus(order.paymentStatus);
        setView(nextView);
        if (nextView !== "checking" || attempts >= 29) return;
      } catch {
        if (cancelled) return;
        setConnectionIssue(true);
        if (attempts >= 29) return;
      }

      attempts += 1;
      timeoutId = window.setTimeout(checkStatus, 2_000);
    };

    void checkStatus();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [contextMatches, context]);

  const state = states[view];
  const returnPath = contextMatches && context ? context.returnPath : "/";

  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-background px-5 py-12 text-foreground">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-border" />
      <div aria-hidden="true" className="absolute -right-24 top-1/4 h-64 w-64 rounded-full bg-[hsl(var(--sage-subtle))] blur-3xl" />

      <section className="relative mx-auto w-full max-w-xl border border-border bg-card px-6 py-8 sm:px-10 sm:py-10">
        <div className={`mb-8 flex h-12 w-12 items-center justify-center rounded-full ${state.accent}`}>
          <state.Icon aria-hidden="true" className={`h-6 w-6 ${view === "checking" ? "animate-pulse" : ""}`} />
        </div>

        <p className="mb-3 font-mono text-xs font-medium tracking-[0.12em] text-muted-foreground">
          {state.eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          {state.title}
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
          {state.description}
        </p>

        {view === "checking" && (
          <div className="mt-6 flex items-center gap-2 border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin" />
            {connectionIssue ? "Reconectando para consultar o pedido..." : "Atualizando o status automaticamente..."}
          </div>
        )}

        <div className="mt-9 border-t border-border pt-6">
          <Button asChild className="min-h-11 w-full sm:w-auto" variant={view === "failed" ? "outline" : "default"}>
            <Link to={returnPath}>{contextMatches ? "Voltar ao pedido" : "Voltar ao Vapt"}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
