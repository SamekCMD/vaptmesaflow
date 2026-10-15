import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { PLANS } from "@/lib/plans";
import { toast } from "@/hooks/use-toast";
import { billingClient, redirectToBilling, type BillingPlanType } from "@/lib/billing-client";

const PricingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { planType, planStatus, restaurantId, canManageBilling, canStartCheckout, loading, billingError } = useSubscription();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);
  const managed = canManageBilling && !canStartCheckout;

  const handleSubscribe = async (planId?: BillingPlanType) => {
    if (!user) {
      navigate(`/login?redirect=/pricing`);
      return;
    }

    if (!restaurantId) {
      toast({ title: "Complete o onboarding primeiro", variant: "destructive" });
      navigate("/onboarding");
      return;
    }

    if (requestInFlight.current || loading) return;
    requestInFlight.current = true; setPending(true); setError(null);
    try {
      const result = managed || !planId
        ? await billingClient.createPortal(restaurantId)
        : await billingClient.createCheckout({ restaurantId, planType: planId });
      redirectToBilling(result.url);
    } catch {
      setError("Não foi possível abrir a cobrança. Tente novamente.");
    } finally {
      requestInFlight.current = false; setPending(false);
    }
  };

  const isCurrentPlan = (planId: string) => user && planStatus === "active" && planType === planId;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="container flex items-center gap-4 py-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={user ? "/dashboard" : "/"} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Link to="/" className="text-base font-semibold text-foreground">
            Vapt
          </Link>
        </div>
      </div>

      <div className="container py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-16 text-center">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
            Escolha o plano ideal para seu restaurante
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground">
            Comece com 3 dias de teste grátis. Sem compromisso, cancele quando quiser.
          </p>
        </motion.div>

        {(error || (user && billingError)) && <p role="alert" className="mb-6 text-center text-sm text-destructive">{error || billingError}</p>}
        {pending && <p role="status" className="mb-6 text-center text-sm">Abrindo cobrança segura…</p>}
        {user && managed && (
          <div className="mb-6 text-center">
            <Button disabled={pending || loading} onClick={() => void handleSubscribe()}>Gerenciar cobrança</Button>
          </div>
        )}
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card
                className={`relative flex h-full flex-col overflow-hidden card-hover ${
                  plan.highlighted
                    ? "border-primary/35 bg-[linear-gradient(160deg,hsl(155_18%_11%)_0%,hsl(150_18%_9%)_100%)] text-primary-foreground shadow-[0_24px_80px_rgba(18,31,24,0.18)]"
                    : "border-border bg-card"
                }`}
              >
                <CardHeader className={`pb-2 ${plan.highlighted ? "pt-5" : ""}`}>
                  <div className="mb-3 flex min-h-7 flex-wrap items-center gap-2">
                    {plan.highlighted && (
                      <Badge className="border-primary/20 bg-primary text-primary-foreground normal-case tracking-normal text-xs">
                        Mais Popular
                      </Badge>
                    )}
                    {isCurrentPlan(plan.id) && (
                      <Badge
                        variant={plan.highlighted ? "outline" : "secondary"}
                        className={plan.highlighted ? "border-primary-foreground/20 text-primary-foreground" : ""}
                      >
                        Plano Atual
                      </Badge>
                    )}
                  </div>

                  <CardTitle className={`text-base font-medium ${plan.highlighted ? "text-primary-foreground" : ""}`}>
                    {plan.name}
                  </CardTitle>

                  <div className="pt-4">
                    <span className={`font-mono text-3xl font-semibold ${plan.highlighted ? "text-primary-foreground" : ""}`}>
                      R$ {plan.price}
                    </span>
                    <span className={`text-sm ${plan.highlighted ? "text-primary-foreground/72" : "text-muted-foreground"}`}>/mês</span>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col pt-4">
                  <ul className="mb-4 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className={`flex items-start gap-2 text-sm ${plan.highlighted ? "text-primary-foreground/92" : ""}`}>
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
                        <span>{feature}</span>
                      </li>
                    ))}

                    {plan.blockedFeatures.map((feature) => (
                      <li
                        key={feature}
                        className={`flex items-start gap-2 text-sm ${
                          plan.highlighted ? "text-primary-foreground/40" : "text-muted-foreground/50"
                        }`}
                      >
                        <X className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
                        <span className="line-through">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {!managed && <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    disabled={pending || (!!user && loading)}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    Assinar Agora
                  </Button>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          Todos os planos incluem 3 dias grátis de teste. Cancele a qualquer momento.
        </p>

      </div>
    </div>
  );
};

export default PricingPage;
