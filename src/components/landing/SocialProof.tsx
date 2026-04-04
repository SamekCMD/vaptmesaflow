import { motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, Clock3, LayoutDashboard, ShieldCheck } from "lucide-react";

const proofMetrics = [
  {
    label: "Tempo de atendimento",
    value: "40% mais rápido",
    detail: "com o salão vendo pedido e status na mesma tela",
  },
  {
    label: "Pedidos no pico",
    value: "98% rastreados",
    detail: "sem perder prioridade quando a fila aperta",
  },
  {
    label: "Fechamento diário",
    value: "12 min",
    detail: "da conferência ao caixa, sem retrabalho",
  },
];

const operationalSignals = [
  {
    icon: Clock3,
    title: "Salão",
    text: "Mesa, pedido e preparo ficam visíveis no mesmo fluxo.",
  },
  {
    icon: BadgeCheck,
    title: "Cozinha",
    text: "Urgências sobem antes do atraso crescer.",
  },
  {
    icon: LayoutDashboard,
    title: "Caixa",
    text: "Conferência e repasse saem mais rápido no fechamento.",
  },
];

const partners = [
  "Bistrô du Chef",
  "Sushi Express",
  "Burguer Point",
  "Trattoria Bella",
  "Café Central",
  "Poke House",
];

const SocialProof = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const entranceEase = [0.16, 1, 0.3, 1] as const;

  return (
    <section className="py-24 bg-background">
      <div className="container">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: entranceEase }}
          className="text-center max-w-3xl mx-auto"
        >
          <p className="text-[11px] text-muted-foreground uppercase tracking-[0.08em] font-medium mb-4">
            Prova operacional em campo
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">
            Confiança que aparece no salão, na cozinha e no caixa
          </h2>
          <p className="text-muted-foreground text-base">
            Números visíveis, rotinas mais curtas e uma operação que dá para confiar antes do atraso aparecer.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3 mt-12">
          {proofMetrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.45,
                delay: prefersReducedMotion ? 0 : i * 0.08,
                ease: entranceEase,
              }}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">
                {metric.label}
              </p>
              <p className="text-2xl font-semibold tracking-tight text-foreground mb-2">{metric.value}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{metric.detail}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: entranceEase }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-6">
              Sinais de operação
            </p>
            <div className="space-y-5">
              {operationalSignals.map((signal) => (
                <div key={signal.title} className="flex items-start gap-3">
                  <div className="mt-0.5 h-10 w-10 rounded-md bg-accent flex items-center justify-center shrink-0">
                    <signal.icon className="h-4.5 w-4.5 text-primary" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{signal.title}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{signal.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: entranceEase }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-1">
                  Operando com
                </p>
                <p className="text-sm font-medium text-foreground">
                  Restaurantes que precisam decidir rápido
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-primary shrink-0" strokeWidth={1.8} />
            </div>
            <div className="flex flex-wrap gap-3">
              {partners.map((partner) => (
                <span
                  key={partner}
                  className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground"
                >
                  {partner}
                </span>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Sem promessa genérica: o salão enxerga, a cozinha prioriza e o caixa fecha com clareza.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default SocialProof;