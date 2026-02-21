import { Link } from "react-router-dom";
import { Clock, AlertTriangle, XCircle } from "lucide-react";
import { usePlan } from "@/hooks/use-plan";

const TrialBanner = () => {
  const { planStatus, trialDaysLeft, trialLabel, isActive } = usePlan();

  if (planStatus !== "trialing") return null;

  const variant = trialDaysLeft > 1 ? "info" : trialDaysLeft === 1 ? "warning" : "danger";

  const styles = {
    info: "bg-primary/10 border-primary/30 text-primary",
    warning: "bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/30 text-[hsl(var(--warning))]",
    danger: "bg-destructive/10 border-destructive/30 text-destructive",
  };

  const Icon = variant === "info" ? Clock : variant === "warning" ? AlertTriangle : XCircle;

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium ${styles[variant]}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{trialLabel}</span>
      </div>
      <Link
        to="/pricing"
        className="text-xs font-semibold underline underline-offset-2 hover:opacity-80 whitespace-nowrap"
      >
        {isActive ? "Assinar Plano" : "Assinar para continuar"}
      </Link>
    </div>
  );
};

export default TrialBanner;
