import { Link } from "react-router-dom";
import { Clock, AlertTriangle, XCircle } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

const TrialBanner = () => {
  const { planStatus, trialDaysLeft, isTrialing, isActive } = useSubscription();

  if (planStatus !== "trialing") return null;

  const variant = trialDaysLeft > 3 ? "info" : trialDaysLeft > 1 ? "warning" : "danger";

  const styles = {
    info: "bg-[hsl(220_27%_13%)] border-[hsl(213_21%_19%)] text-[hsl(216_34%_64%)]",
    warning: "bg-[hsl(37_27%_13%)] border-[hsl(35_31%_18%)] text-[hsl(44_51%_54%)]",
    danger: "bg-[hsl(0_27%_13%)] border-[hsl(0_23%_19%)] text-destructive",
  };

  const Icon = variant === "info" ? Clock : variant === "warning" ? AlertTriangle : XCircle;

  const label = isTrialing
    ? trialDaysLeft > 1
      ? `Seu trial termina em ${trialDaysLeft} dias — Assine agora para continuar usando o Vapt.`
      : trialDaysLeft === 1
      ? "Seu teste expira amanhã!"
      : "Seu teste expirou"
    : "Seu teste expirou";

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-md border text-sm font-medium ${styles[variant]}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span>{label}</span>
      </div>
      <Link
        to="/dashboard/subscription"
        className="text-xs font-medium underline underline-offset-2 hover:opacity-80 whitespace-nowrap"
      >
        {isActive ? "Ver Planos" : "Assinar para continuar"}
      </Link>
    </div>
  );
};

export default TrialBanner;
