import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const HeroDashboardMockup = () => {
  return (
    <div className="relative">
      <div className="relative rounded-lg border border-border bg-card shadow-lg overflow-hidden p-5">
        {/* Top bar */}
        <div className="flex items-center gap-2 mb-5">
          <div className="h-2.5 w-2.5 rounded-full bg-[hsl(0_38%_64%)]/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-[hsl(44_51%_54%)]/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-primary/60" />
          <div className="ml-3 h-4 w-36 rounded bg-secondary" />
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Vendas Hoje", value: "R$ 4.280", trend: "+12%" },
            { label: "Pedidos", value: "47", trend: "+8%" },
            { label: "Ticket Médio", value: "R$ 91", trend: "+3%" },
          ].map((m) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + Math.random() * 0.3 }}
              className="rounded-md bg-secondary border border-border p-3"
            >
              <p className="text-[10px] text-muted-foreground mb-1">{m.label}</p>
              <p className="text-sm font-medium font-mono text-foreground">{m.value}</p>
              <p className="text-[10px] text-primary mt-0.5">{m.trend}</p>
            </motion.div>
          ))}
        </div>

        {/* Chart area */}
        <div className="rounded-md bg-secondary border border-border p-4 mb-4">
          <p className="text-[10px] text-muted-foreground mb-3">Faturamento Semanal</p>
          <div className="flex items-end gap-2 h-20">
            {[40, 65, 50, 80, 70, 90, 75].map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.6, delay: 0.8 + i * 0.08 }}
                className="flex-1 rounded-t bg-primary/80"
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
              <span key={d} className="text-[8px] text-muted-foreground flex-1 text-center">{d}</span>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <div className="rounded-md bg-secondary border border-border p-3">
          <p className="text-[10px] text-muted-foreground mb-2">Pedidos Recentes</p>
          {[
            { id: "#101", status: "Preparando", variant: "info" as const },
            { id: "#102", status: "Na Fila", variant: "secondary" as const },
            { id: "#103", status: "Pronto", variant: "default" as const },
          ].map((o) => (
            <div key={o.id} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-foreground/70 font-mono font-medium">{o.id}</span>
              <Badge variant={o.variant} className="text-[9px] normal-case tracking-normal">{o.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroDashboardMockup;
