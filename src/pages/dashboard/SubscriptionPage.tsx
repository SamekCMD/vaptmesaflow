import { useState } from "react";
import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
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
import { useToast } from "@/hooks/use-toast";
import StripeCheckoutModal from "@/components/dashboard/StripeCheckoutModal";

const PLAN_ORDER = ["starter", "pro", "business"] as const;

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
  const { planType, planStatus, isTrialing, trialDaysLeft, refetch } = useSubscription();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<PlanDefinition | null>(null);
  const [pendingPlan, setPendingPlan] = useState<PlanDefinition | null>(null);

  const activePlanId = planStatus === "active" ? planType : null;
  const currentPlan = PLANS.find((p) => p.id === activePlanId);
  const currentPlanName = currentPlan?.name ?? planType;
  const currentPlanIndex = activePlanId ? PLAN_ORDER.indexOf(activePlanId) : -1;

  const handlePlanClick = (plan: PlanDefinition) => {
    if (planStatus === "active") {
      setPendingPlan(plan);
    } else {
      setSelectedPlan(plan);
    }
  };

  const handleConfirmUpgrade = () => {
    setSelectedPlan(pendingPlan);
    setPendingPlan(null);
  };

  const handleAutoCharged = () => {
    setSelectedPlan(null);
    toast({ title: "Plano atualizado com sucesso!" });
    refetch();
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
              {currentPlan.id !== "business" && (
                <Button
                  size="sm"
                  onClick={() => {
                    const nextPlan = PLANS.find((p) => PLAN_ORDER.indexOf(p.id) > currentPlanIndex);
                    if (nextPlan) handlePlanClick(nextPlan);
                  }}
                >
                  Fazer Upgrade
                </Button>
              )}
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
            {/* Action row */}
            <TableRow className="hover:bg-transparent border-t-2 border-border">
              <TableCell />
              {PLANS.map((plan) => {
                const isCurrent = plan.id === activePlanId;
                const planIndex = PLAN_ORDER.indexOf(plan.id);
                const isBelow = currentPlanIndex >= 0 && planIndex < currentPlanIndex;
                return (
                  <TableCell
                    key={plan.id}
                    className={`text-center py-4 ${isCurrent ? "bg-accent/30 border-x-2 border-primary/20" : ""}`}
                  >
                    {isCurrent ? (
                      <Button variant="ghost" size="sm" disabled className="text-[12px]">
                        Plano Atual
                      </Button>
                    ) : isBelow ? null : (
                      <Button
                        size="sm"
                        variant="default"
                        className="text-[12px]"
                        onClick={() => handlePlanClick(plan)}
                      >
                        {planStatus === "active" ? "Fazer Upgrade" : `Assinar ${plan.name}`}
                      </Button>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={!!pendingPlan} onOpenChange={(open) => !open && setPendingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar troca de plano</AlertDialogTitle>
            <AlertDialogDescription>
              Você está trocando do plano {currentPlanName} para {pendingPlan?.name}. O valor de R$ {pendingPlan?.price},00 será cobrado imediatamente no cartão cadastrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleConfirmUpgrade}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StripeCheckoutModal
        open={!!selectedPlan}
        onOpenChange={(open) => !open && setSelectedPlan(null)}
        plan={selectedPlan}
        onAutoCharged={handleAutoCharged}
      />
    </div>
  );
};

export default SubscriptionPage;
