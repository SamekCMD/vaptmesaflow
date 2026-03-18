import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";

interface FeatureGateProps {
  feature: string;
  requiredPlan: string;
  children: ReactNode;
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

const FeatureGate = ({ feature, requiredPlan, children }: FeatureGateProps) => {
  const { canAccess, loading } = useSubscription();

  if (loading) return <>{children}</>;

  if (!canAccess(feature)) {
    return (
      <div className="relative min-h-[60vh]">
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10 rounded-lg border border-border">
          <div className="flex flex-col items-center gap-4 text-center p-8">
            <div className="h-14 w-14 rounded-lg bg-secondary flex items-center justify-center">
              <Lock className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-semibold">Funcionalidade Bloqueada</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Disponível no Plano <span className="font-medium text-primary">{PLAN_LABELS[requiredPlan] || requiredPlan}</span>.
              Faça upgrade para desbloquear.
            </p>
            <Button asChild>
              <Link to="/dashboard/subscription">Ver Planos</Link>
            </Button>
          </div>
        </div>
        <div className="opacity-10 pointer-events-none select-none">{children}</div>
      </div>
    );
  }

  return <>{children}</>;
};

export default FeatureGate;
