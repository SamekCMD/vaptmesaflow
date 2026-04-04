import { Card, CardContent } from "@/components/ui/card";
import { motion, useReducedMotion } from "framer-motion";
import { QrCode, Monitor, BarChart3 } from "lucide-react";

const storyBlocks = [
  {
    icon: QrCode,
    title: "Cardápio e mesas",
    step: "Mesa 01",
    description: "O salão acompanha pedidos, status e cardápio sem alternar entre telas.",
    outcome: "Menos atrito na mesa.",
  },
  {
    icon: Monitor,
    title: "Cozinha",
    step: "Fila 02",
    description: "A produção enxerga urgências, tempos e prioridades antes do atraso crescer.",
    outcome: "Menos atraso no pico.",
  },
  {
    icon: BarChart3,
    title: "Caixa",
    step: "Fechamento 03",
    description: "O fechamento fecha a conta com recebimento, conferência e ticket no mesmo fluxo.",
    outcome: "Fechamento mais rápido.",
  },
  {
    icon: BarChart3,
    title: "Gestão",
    step: "Painel 04",
    description: "O dono vê receita, giro e operação para decidir com contexto, não suposição.",
    outcome: "Decisão mais rápida.",
  },
];

const Features = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const entranceEase = [0.16, 1, 0.3, 1] as const;

  return (
    <section id="funcionalidades" className="py-24 bg-background">
      <div className="container">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: entranceEase }}
          className="text-center mb-16"
        >
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">
            Da mesa ao fechamento, o fluxo fica legível
          </h2>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto">
            Cada etapa mostra o que acontece agora, o que precisa de atenção e o que já pode seguir.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2">
          {storyBlocks.map((block, i) => (
            <motion.div
              key={block.title}
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={prefersReducedMotion ? undefined : { y: -4 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.45,
                delay: prefersReducedMotion ? 0 : i * 0.08,
                ease: entranceEase,
              }}
            >
              <Card className="card-hover h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="h-10 w-10 rounded-md bg-accent flex items-center justify-center shrink-0">
                      <block.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
                      {block.step}
                    </span>
                  </div>

                  <h3 className="font-medium text-base mb-2">{block.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                    {block.description}
                  </p>
                  <p className="text-sm font-medium text-foreground">{block.outcome}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
