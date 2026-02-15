import { motion } from "framer-motion";

const HeroDashboardMockup = () => {
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-primary/10 rounded-2xl blur-3xl" />
      <div className="relative rounded-xl border border-primary/20 bg-[hsl(225_20%_10%)] shadow-2xl overflow-hidden p-5">
        {/* Top bar */}
        <div className="flex items-center gap-2 mb-5">
          <div className="h-3 w-3 rounded-full bg-destructive/60" />
          <div className="h-3 w-3 rounded-full bg-warning/60" />
          <div className="h-3 w-3 rounded-full bg-primary/60" />
          <div className="ml-3 h-5 w-40 rounded bg-white/5" />
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
              className="rounded-lg bg-white/5 border border-white/10 p-3"
            >
              <p className="text-[10px] text-white/40 mb-1">{m.label}</p>
              <p className="text-sm font-bold text-white">{m.value}</p>
              <p className="text-[10px] text-primary mt-0.5">{m.trend}</p>
            </motion.div>
          ))}
        </div>

        {/* Chart area */}
        <div className="rounded-lg bg-white/5 border border-white/10 p-4 mb-4">
          <p className="text-[10px] text-white/40 mb-3">Faturamento Semanal</p>
          <div className="flex items-end gap-2 h-20">
            {[40, 65, 50, 80, 70, 90, 75].map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.6, delay: 0.8 + i * 0.08 }}
                className="flex-1 rounded-t bg-gradient-to-t from-primary/60 to-primary"
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
              <span key={d} className="text-[8px] text-white/30 flex-1 text-center">{d}</span>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <p className="text-[10px] text-white/40 mb-2">Pedidos Recentes</p>
          {[
            { id: "#101", status: "Preparando", color: "bg-info" },
            { id: "#102", status: "Na Fila", color: "bg-warning" },
            { id: "#103", status: "Pronto", color: "bg-primary" },
          ].map((o) => (
            <div key={o.id} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-white/70 font-medium">{o.id}</span>
              <span className={`text-[9px] px-2 py-0.5 rounded-full text-white ${o.color}`}>{o.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroDashboardMockup;
