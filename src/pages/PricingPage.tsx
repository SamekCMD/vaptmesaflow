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
    if (!user) {
      navigate(`/login?redirect=/pricing`);
      return;
    }

    if (!restaurantId) {
      toast({ title: "Complete o onboarding primeiro", variant: "destructive" });
      navigate("/onboarding");
      return;
    }

    setCheckoutLoading(planId);
    try {
      const res = await fetch(N8N_CHECKOUT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          email: user.email,
          price_id: priceId,
          success_url: `${window.location.origin}/dashboard?checkout=success`,
          cancel_url: `${window.location.origin}/pricing`,
        }),
      });

      const data = await res.json();

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("URL de checkout não retornada");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast({
        title: "Erro ao iniciar checkout",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const isCurrentPlan = (planId: string) =>
    user && planStatus === "active" && planType === planId;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="hero-gradient border-b border-border">
        <div className="container py-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="text-hero-foreground hover:bg-hero-muted/10">
            <Link to={user ? "/dashboard" : "/"}><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <Link to="/" className="text-xl font-bold">
            <span className="text-gradient">Vapt</span>
          </Link>
        </div>
      </div>

      <div className="container py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Escolha o plano ideal para seu restaurante
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Comece com 3 dias de teste grátis. Sem compromisso, cancele quando quiser.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card
                className={`h-full flex flex-col card-hover ${
                  plan.highlighted
                    ? "border-primary glow relative"
                    : "border-border/50"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Mais Popular
                  </div>
                )}

                {isCurrentPlan(plan.id) && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-primary/10 text-primary border-primary/30">
                      Plano Atual
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">{plan.name}</CardTitle>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">R$ {plan.price}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 flex-1 flex flex-col">
                  <ul className="space-y-3 mb-4 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                    {plan.blockedFeatures.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground/50">
                        <X className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="line-through">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    disabled={!!isCurrentPlan(plan.id) || !!checkoutLoading}
                    onClick={() => handleSubscribe(plan.priceId, plan.id)}
                  >
                    {checkoutLoading === plan.id ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
                    ) : isCurrentPlan(plan.id) ? (
                      "Plano Atual"
                    ) : (
                      "Assinar Agora"
                    )}
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
