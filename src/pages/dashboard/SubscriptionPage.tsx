import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { PLANS, type PlanDefinition } from "@/lib/plans";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import StripeCheckoutModal from "@/components/dashboard/StripeCheckoutModal";

const SubscriptionPage = () => {
  const { planType, planStatus, isTrialing, trialDaysLeft, refetch } = useSubscription();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<PlanDefinition | null>(null);
  const [pendingPlan, setPendingPlan] = useState<PlanDefinition | null>(null);

  const isCurrentPlan = (planId: string) => {
    if (planStatus !== "active") return false;
    return planType === planId;
  };

  const currentPlanName = PLANS.find((p) => p.id === planType)?.name ?? planType;

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Assinatura</h1>
        <p className="text-muted-foreground text-sm">
          {isTrialing
            ? `Você está no período de teste — ${trialDaysLeft} dia${trialDaysLeft !== 1 ? "s" : ""} restante${trialDaysLeft !== 1 ? "s" : ""}.`
            : planStatus === "active"
            ? `Seu plano atual é ${planType}.`
            : "Escolha um plano para continuar usando o Vapt."}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan, i) => {
          const current = isCurrentPlan(plan.id);
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="relative"
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-primary text-primary-foreground gap-1 font-display text-[11px] font-medium shadow-[var(--shadow-coral)]">
                    <Crown className="h-3 w-3" />
                    Mais Popular
                  </Badge>
                </div>
              )}
              <Card
                className={`relative h-full flex flex-col rounded-xl ${
                  current
                    ? "border-primary border-[1.5px] shadow-[var(--shadow-coral)]"
                    : plan.highlighted
                    ? "border-border/80"
                    : "border-border"
                }`}
              >
                {current && (
                  <div className="absolute -top-3 right-4">
                    <Badge variant="secondary" className="text-text-tertiary">Plano Atual</Badge>
                  </div>
                )}

                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-display">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-bold font-display">R$ {plan.price}</span>
                    <span className="text-text-secondary text-sm">/mês</span>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-2.5 flex-1 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px]">
                        <Check className="h-4 w-4 text-status-success mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                    {plan.blockedFeatures.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-text-tertiary line-through">
                        <X className="h-4 w-4 text-status-error mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {current ? (
                    <Button
                      className="w-full bg-transparent border border-border text-text-tertiary pointer-events-none"
                      variant="outline"
                      disabled
                    >
                      Plano Atual
                    </Button>
                  ) : (
                    <Button
                      className="w-full font-display text-sm"
                      onClick={() => handlePlanClick(plan)}
                    >
                      Assinar {plan.name}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Confirmation dialog for active subscribers upgrading */}
      <AlertDialog open={!!pendingPlan} onOpenChange={(open) => !open && setPendingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Confirmar troca de plano</AlertDialogTitle>
            <AlertDialogDescription>
              Você está trocando do plano {currentPlanName} para {pendingPlan?.name}. O valor de R$ {pendingPlan?.price},00 será cobrado imediatamente no cartão cadastrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-brand-coral-hover"
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
