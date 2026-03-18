import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Check, X, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { PLANS } from "@/lib/plans";

const Pricing = () => {
  return (
    <section id="planos" className="py-24 bg-secondary/30">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight mb-4">
            Planos simples e transparentes
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Escolha o plano ideal para o tamanho da sua operação. Comece com 3 dias grátis.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
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
              <Card className={`h-full card-hover rounded-xl ${plan.highlighted ? "border-primary/50 glow" : ""}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-display">{plan.name}</CardTitle>
                  <div className="pt-4">
                    <span className="text-4xl font-bold font-display">R$ {plan.price}</span>
                    <span className="text-text-secondary text-sm">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px]">
                        <Check className="h-4 w-4 text-status-success mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                    {plan.blockedFeatures.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-text-tertiary">
                        <X className="h-4 w-4 text-status-error mt-0.5 shrink-0" />
                        <span className="line-through">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full font-display" variant={plan.highlighted ? "default" : "outline"}>
                    <Link to="/pricing">Começar Agora</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
