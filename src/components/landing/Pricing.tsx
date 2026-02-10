import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Básico",
    price: "R$ 99",
    period: "/mês",
    description: "Para restaurantes começando a digitalizar",
    features: [
      "Cardápio digital ilimitado",
      "QR Codes para mesas",
      "Até 200 pedidos/mês",
      "Suporte por e-mail",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "R$ 249",
    period: "/mês",
    description: "O mais popular para restaurantes em crescimento",
    features: [
      "Tudo do Básico",
      "KDS - Monitor de Cozinha",
      "WhatsApp Bot com IA",
      "Pedidos ilimitados",
      "Dashboard de métricas",
      "Suporte prioritário",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "R$ 499",
    period: "/mês",
    description: "Para redes e operações de alto volume",
    features: [
      "Tudo do Pro",
      "Multi-unidades",
      "API personalizada",
      "Relatórios avançados",
      "Gerente de conta dedicado",
      "SLA 99.9%",
    ],
    highlighted: false,
  },
];

const Pricing = () => {
  return (
    <section id="planos" className="py-24 bg-muted/30">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Planos simples e transparentes
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Escolha o plano ideal para o tamanho da sua operação. Sem surpresas.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className={`h-full card-hover ${plan.highlighted ? "border-primary glow relative" : "border-border/50"}`}>
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Mais Popular
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="pt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                    <Link to="/dashboard">Começar Agora</Link>
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
