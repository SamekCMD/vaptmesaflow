import { useEffect, useRef, useState } from "react";
import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PLANS, type PlanDefinition } from "@/lib/plans";
import { useSubscription } from "@/hooks/useSubscription";
import { billingClient, redirectToBilling } from "@/lib/billing-client";
import { VaptApiClientError } from "@/lib/vapt-api-client";

const COMPARISON_FEATURES = [
  { label: "Cardápio digital", plans: ["starter", "pro", "business"] },
  { label: "QR Code por mesa", plans: ["starter", "pro", "business"] },
  { label: "KDS (Cozinha)", plans: ["starter", "pro", "business"] },
  { label: "Pedidos ilimitados", plans: ["starter", "pro", "business"] },
  { label: "Caixa e Comanda Aberta", plans: ["pro", "business"] },
  { label: "Dashboard de métricas", plans: ["pro", "business"] },
  { label: "Suporte prioritário", plans: ["pro", "business"] },
  { label: "Multi-usuários", plans: ["business"] },
  { label: "Múltiplas unidades", plans: ["business"] },
  { label: "Relatórios avançados", plans: ["business"] },
  { label: "Gerente de conta dedicado", plans: ["business"] },
];

const SubscriptionPage = () => {
  const { planType, planStatus, isTrialing, trialDaysLeft, restaurantId,
    canManageBilling, requiresBillingAction, billingError, loading, refetch } = useSubscription();
  const [pending, setPending] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);
  const activePlanId = planStatus === "active" ? planType : null;
  const currentPlan = PLANS.find(p => p.id === activePlanId);
  const showCheckout = !canManageBilling || planStatus === "expired" || planStatus === "cancelled";

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") === "returned") void refetch();
  }, [refetch]);

  const openBilling = async (plan?: PlanDefinition) => {
    if (!restaurantId || loading || requestInFlight.current) return;
    requestInFlight.current = true;
    setPending(plan ? "checkout" : "portal");
    setError(null);
    try {
      const result = plan
        ? await billingClient.createCheckout({ restaurantId, planType: plan.id })
        : await billingClient.createPortal(restaurantId);
      redirectToBilling(result.url);
    } catch (failure) {
      setError(failure instanceof VaptApiClientError && failure.status === 401
        ? "Sua sessão expirou. Entre novamente para gerenciar a cobrança."
        : failure instanceof VaptApiClientError && failure.status === 409
        ? "Há uma assinatura ou pagamento em andamento. Atualize a página ou abra Gerenciar cobrança e tente novamente."
        : "Não foi possível abrir a cobrança. Tente novamente.");
    } finally {
      requestInFlight.current = false;
      setPending(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Assinatura</h1>
        <p className="text-muted-foreground text-sm">
          {isTrialing
            ? `Você está no período de teste — ${trialDaysLeft} dia${trialDaysLeft !== 1 ? "s" : ""} restante${trialDaysLeft !== 1 ? "s" : ""}.`
            : planStatus === "active"
            ? "Gerencie seu plano e veja o comparativo de funcionalidades."
            : "Escolha um plano para continuar usando o Vapt."}
        </p>
      </div>

      {requiresBillingAction && (
        <p role="alert" className="text-sm text-destructive">
          Sua cobrança precisa de atenção. Abra Gerenciar cobrança para revisar o pagamento.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {billingError && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">{billingError}</p>
          <Button variant="outline" disabled={loading} onClick={() => void refetch()}>Tentar novamente</Button>
        </div>
      )}
      {pending && <p role="status" className="text-sm text-muted-foreground">Abrindo cobrança segura…</p>}
      {canManageBilling && (
        <Button disabled={loading || pending !== null || !restaurantId} onClick={() => void openBilling()}>
          Gerenciar cobrança
        </Button>
      )}

      {/* Current Plan Card */}
      {planStatus === "active" && currentPlan && (
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-2">Plano Atual</p>
              <h2 className="text-2xl font-semibold tracking-tight">{currentPlan.name}</h2>
              <p className="mono text-lg mt-1">R$ {currentPlan.price}<span className="text-muted-foreground text-sm">/mês</span></p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <Badge variant="outline" className="border-primary/30 text-primary bg-accent">
                Plano Ativo
              </Badge>

            </div>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Comparativo de Planos</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[240px] text-[13px]">Funcionalidade</TableHead>
              {PLANS.map((plan) => {
                const isCurrent = plan.id === activePlanId;
                return (
                  <TableHead
                    key={plan.id}
                    className={`text-center text-[13px] ${isCurrent ? "bg-accent/50 border-x-2 border-primary/20" : ""}`}
                  >
                    <div className="font-medium">{plan.name}{isCurrent ? " ★" : ""}</div>
                    <div className="mono text-muted-foreground text-xs mt-0.5">R$ {plan.price}/mês</div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {COMPARISON_FEATURES.map((feature) => (
              <TableRow key={feature.label} className="hover:bg-muted/50">
                <TableCell className="text-[13px]">{feature.label}</TableCell>
                {PLANS.map((plan) => {
                  const isCurrent = plan.id === activePlanId;
                  const hasFeature = feature.plans.includes(plan.id);
                  return (
                    <TableCell
                      key={plan.id}
                      className={`text-center ${isCurrent ? "bg-accent/30 border-x-2 border-primary/20" : ""}`}
                    >
                      {hasFeature ? (
                        <Check className="h-4 w-4 text-primary mx-auto" strokeWidth={2} />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" strokeWidth={1.5} />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {showCheckout && (
              <TableRow className="hover:bg-transparent border-t-2 border-border">
                <TableCell />
                {PLANS.map(plan => (
                  <TableCell key={plan.id} className="text-center py-4">
                    <Button size="sm" className="text-[12px]"
                      disabled={loading || pending !== null || !restaurantId}
                      onClick={() => void openBilling(plan)}>
                      Assinar {plan.name}
                    </Button>
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

    </div>
  );
};

export default SubscriptionPage;
