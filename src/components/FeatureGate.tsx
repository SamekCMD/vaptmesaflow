import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlan, PLAN_LABELS, type PlanType } from "@/hooks/use-plan";

interface FeatureGateProps {
  feature: "cashier" | "open_tab" | "whatsapp_bot" | "multi_users";
  requiredPlan: PlanType;
  children: ReactNode;
}

const FeatureGate = ({ feature, requiredPlan, children }: FeatureGateProps) => {
  const { canAccess, loading } = usePlan();

  if (loading) return <>{children}</>;

  if (!canAccess(feature)) {
    return (
      <div className="relative min-h-[60vh]">
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10 rounded-lg border border-border">
          <div className="flex flex-col items-center gap-4 text-center p-8">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold">Funcionalidade Bloqueada</h2>
            <p className="text-muted-foreground max-w-sm">
              Disponível no Plano <span className="font-semibold text-primary">{PLAN_LABELS[requiredPlan]}</span>.
              Faça upgrade para desbloquear.
            </p>
            <Button asChild>
              <Link to="/pricing">Ver Planos</Link>
            </Button>
          </div>
        </div>
        <div className="opacity-20 pointer-events-none select-none">{children}</div>
      </div>
    );
  }

  return <>{children}</>;
};

export default FeatureGate;
