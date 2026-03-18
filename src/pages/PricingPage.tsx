import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, X, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/use-plan";
import { PLANS } from "@/lib/plans";
import { N8N_CHECKOUT_WEBHOOK_URL } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";

const PricingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { planType, planStatus, restaurantId, isActive, loading: planLoading } = usePlan();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string, planId: string) => {
    if (!user) { navigate(`/login?redirect=/pricing`); return; }
    if (!restaurantId) { toast({ title: "Complete o onboarding primeiro", variant: "destructive" }); navigate("/onboarding"); return; }
    setCheckoutLoading(planId);
    try {
      if (!N8N_CHECKOUT_WEBHOOK_URL) throw new Error("Webhook de checkout não configurado");
      const res = await fetch(N8N_CHECKOUT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: restaurantId, email: user.email, price_id: priceId, success_url: `${window.location.origin}/dashboard?checkout=success`, cancel_url: `${window.location.origin}/pricing` }),
      });
      const data = await res.json();
      if (data?.url) { window.location.href = data.url; } else { throw new Error("URL de checkout não retornada"); }
    } catch (err: any) {
      toast({ title: "Erro ao iniciar checkout", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const isCurrentPlan = (planId: string) => user && planStatus === "active" && planType === planId;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="container py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={user ? "/dashboard" : "/"}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <Link to="/" className="text-base font-semibold text-foreground">Vapt</Link>
        </div>
      </div>

      <div className="container py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight mb-4">
            Escolha o plano ideal para seu restaurante
          </h1>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto">
            Comece com 3 dias de teste grátis. Sem compromisso, cancele quando quiser.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan, i) => (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card
                className={`h-full flex flex-col card-hover relative ${plan.highlighted ? "border-[hsl(153_14%_34%)]" : ""}`}
                style={plan.highlighted ? { background: "linear-gradient(135deg, hsl(240 10% 7%), hsl(153 23% 10%))" } : undefined}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="normal-case tracking-normal text-xs">Mais Popular</Badge>
                  </div>
                )}
                {isCurrentPlan(plan.id) && (
                  <div className="absolute -top-3 right-4">
                    <Badge variant="outline">Plano Atual</Badge>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">{plan.name}</CardTitle>
                  <div className="pt-4">
                    <span className="text-3xl font-semibold font-mono">R$ {plan.price}</span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 flex-1 flex flex-col">
                  <ul className="space-y-3 mb-4 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" strokeWidth={1.5} />
                        <span>{f}</span>
                      </li>
                    ))}
                    {plan.blockedFeatures.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground/50">
                        <X className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <span className="line-through">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={plan.highlighted ? "default" : "outline"} disabled={!!isCurrentPlan(plan.id) || !!checkoutLoading} onClick={() => handleSubscribe(plan.priceId, plan.id)}>
                    {checkoutLoading === plan.id ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>) : isCurrentPlan(plan.id) ? "Plano Atual" : "Assinar Agora"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-12">
          Todos os planos incluem 3 dias grátis de teste. Cancele a qualquer momento.
        </p>
      </div>
    </div>
  );
};

export default PricingPage;
