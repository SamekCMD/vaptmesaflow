import { ArrowLeft, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";

type ReturnResult = "success" | "pending" | "failure";

const states: Record<ReturnResult, {
  eyebrow: string;
  title: string;
  description: string;
  Icon: typeof CheckCircle2;
  accent: string;
}> = {
  success: {
    eyebrow: "RETORNO DO PAGAMENTO",
    title: "Pagamento recebido",
    description: "Estamos confirmando o pedido com o Mercado Pago. A cozinha será avisada assim que a confirmação chegar.",
    Icon: CheckCircle2,
    accent: "text-[hsl(var(--sage))] bg-[hsl(var(--sage-subtle))]",
  },
  pending: {
    eyebrow: "PAGAMENTO EM PROCESSAMENTO",
    title: "Pagamento em análise",
    description: "O Mercado Pago ainda está processando a transação. Você pode voltar ao Vapt enquanto aguardamos a confirmação.",
    Icon: Clock3,
    accent: "text-amber-700 bg-amber-50",
  },
  failure: {
    eyebrow: "PAGAMENTO INTERROMPIDO",
    title: "Pagamento não concluído",
    description: "Nenhuma confirmação foi recebida. Volte ao pedido para escolher outra forma de pagamento ou tentar novamente.",
    Icon: XCircle,
    accent: "text-destructive bg-destructive/10",
  },
};

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const requestedResult = searchParams.get("result");
  const result: ReturnResult = requestedResult === "success" || requestedResult === "pending"
    ? requestedResult
    : "failure";
  const state = states[result];

  const retry = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign("/");
  };

  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-background px-5 py-12 text-foreground">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-border" />
      <div aria-hidden="true" className="absolute -right-24 top-1/4 h-64 w-64 rounded-full bg-[hsl(var(--sage-subtle))] blur-3xl" />

      <section className="relative mx-auto w-full max-w-xl border border-border bg-card px-6 py-8 sm:px-10 sm:py-10">
        <div className={`mb-8 flex h-12 w-12 items-center justify-center rounded-full ${state.accent}`}>
          <state.Icon aria-hidden="true" className="h-6 w-6" />
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

        <div className="mt-9 border-t border-border pt-6">
          {result === "failure" ? (
            <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={retry}>
              <ArrowLeft aria-hidden="true" />
              Voltar para tentar novamente
            </Button>
          ) : (
            <Button asChild className="min-h-11 w-full sm:w-auto">
              <Link to="/">Voltar ao Vapt</Link>
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}
