import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { PLANS } from "@/lib/plans";

const planSummaries: Record<string, string> = {
  starter: "Para começar enxuto e ganhar ritmo na operação.",
  pro: "Para o uso diário, com salão, cozinha e caixa em sincronia.",
  business: "Para times maiores e operação em mais de uma frente.",
};

const Pricing = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const entranceEase = [0.16, 1, 0.3, 1] as const;

  return (
    <section id="planos" className="py-24 bg-card">
      <div className="container">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: entranceEase }}
          className="text-center max-w-3xl mx-auto"
        >
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-4">
            3 dias grátis - sem fidelidade - suporte humano
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">
            Planos para rodar sem atrito
          </h2>
          <p className="text-muted-foreground text-base">
            Escolha o plano que acompanha o ritmo do salão, da cozinha e do caixa sem ruído no meio do caminho.
          </p>
        </motion.div>

        <div className="mt-12 max-w-5xl mx-auto rounded-2xl border border-border bg-background/70 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3 text-sm text-muted-foreground">
            <div className="rounded-xl border border-border bg-card px-4 py-3">Setup em minutos</div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">Acompanhe salão, cozinha e caixa</div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">Cresce quando a operação pedir</div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-6">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.45,
                delay: prefersReducedMotion ? 0 : i * 0.08,
                ease: entranceEase,
              }}
            >
              <Card
                className={"h-full card-hover relative " + (plan.highlighted ? "border-[hsl(153_14%_34%)]" : "")}
                style={plan.highlighted ? { background: "linear-gradient(135deg, hsl(240 10% 7%), hsl(153 23% 10%))" } : undefined}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="normal-case tracking-normal text-xs">Mais usado no dia a dia</Badge>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">{planSummaries[plan.id]}</p>
                  <div className="pt-4">
                    <span className="text-3xl font-semibold font-mono">R$ {plan.price}</span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3 mb-8">
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
                  <Button asChild className="w-full" variant={plan.highlighted ? "default" : "outline"}>
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