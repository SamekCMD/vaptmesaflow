import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const entranceEase = [0.16, 1, 0.3, 1] as const;
const chartPoints = [
  { hour: "12h", height: 42 },
  { hour: "13h", height: 58 },
  { hour: "14h", height: 48 },
  { hour: "15h", height: 66 },
  { hour: "16h", height: 74 },
  { hour: "17h", height: 60 },
] as const;

const HeroDashboardMockup = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <div className="relative">
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: entranceEase }}
        className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border bg-secondary/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-[hsl(0_38%_64%)]/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-[hsl(44_51%_54%)]/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-primary/60" />
          </div>
          <div className="flex items-center gap-3 rounded-full border border-border bg-background px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-[11px] text-muted-foreground">cockpit.vapt.app</span>
          </div>
          <Badge variant="info" className="gap-1">
            <motion.span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-current"
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.55, 1, 0.55] }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 1.8, repeat: Infinity, ease: "linear" }
              }
            />
            Ao vivo
          </Badge>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Pedidos abertos", value: "18", trend: "+4 hoje" },
              { label: "Tempo médio", value: "14 min", trend: "-2 min" },
              { label: "Receita hoje", value: "R$ 4.280", trend: "+12%" },
            ].map((metric, i) => (
              <motion.div
                key={metric.label}
                initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.45,
                  delay: prefersReducedMotion ? 0 : 0.15 + i * 0.08,
                  ease: entranceEase,
                }}
                className="rounded-xl border border-border bg-secondary/70 p-3"
              >
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-1 font-mono text-sm font-medium text-foreground">{metric.value}</p>
                <p className="mt-0.5 text-[10px] text-primary">{metric.trend}</p>
              </motion.div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-secondary/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Receita por hora
              </p>
              <span className="text-[10px] text-primary">+12% vs ontem</span>
            </div>
            <div className="relative h-24 overflow-hidden">
              <div className="absolute inset-0 grid grid-rows-4 gap-0">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="border-b border-border/70" />
                ))}
              </div>
              {!prefersReducedMotion && (
                <motion.div
                  aria-hidden="true"
                  initial={{ x: "-18%", opacity: 0 }}
                  animate={{ x: "110%", opacity: [0, 0.28, 0] }}
                  transition={{ duration: 0.9, delay: 0.38, ease: entranceEase }}
                  className="absolute inset-y-2 z-0 w-12 rounded-full bg-primary/10 blur-xl"
                />
              )}
              <div className="relative z-10 flex h-full items-end gap-2">
                {chartPoints.map((point, i) => (
                  <div key={point.hour} className="flex-1">
                    <motion.div
                      initial={
                        prefersReducedMotion
                          ? { height: `${point.height}%`, opacity: 1, scaleY: 1 }
                          : { height: 0, opacity: 0.45, scaleY: 0.75 }
                      }
                      animate={
                        prefersReducedMotion
                          ? { height: `${point.height}%`, opacity: 1, scaleY: 1 }
                          : {
                              height: [`0%`, `${Math.min(point.height + 8, 84)}%`, `${point.height}%`],
                              opacity: [0.45, 1, 0.9],
                              scaleY: [0.75, 1.06, 1],
                            }
                      }
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.72,
                        delay: prefersReducedMotion ? 0 : 0.35 + i * 0.07,
                        ease: entranceEase,
                      }}
                      className="mx-auto w-full max-w-[22px] rounded-t-md bg-primary/80 origin-bottom"
                    >
                      {!prefersReducedMotion && (
                        <motion.div
                          aria-hidden="true"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 0.32, 0] }}
                          transition={{
                            duration: 0.5,
                            delay: 0.55 + i * 0.07,
                            ease: "easeOut",
                          }}
                          className="h-2 w-full rounded-t-md bg-white/35"
                        />
                      )}
                    </motion.div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 flex justify-between">
              {chartPoints.map(({ hour }) => (
                <span key={hour} className="flex-1 text-center text-[8px] text-muted-foreground">
                  {hour}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Fila de preparo
              </p>
              <span className="text-[10px] text-muted-foreground">3 itens ativos</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Mesa 12", detail: "3 itens • 2 min", variant: "info", status: "Preparando" },
                { label: "Mesa 04", detail: "2 itens • 5 min", variant: "secondary", status: "Na fila" },
                { label: "Delivery 18", detail: "1 item • agora", variant: "default", status: "Pronto" },
              ].map((order, i) => (
                <motion.div
                  key={order.label}
                  initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.4,
                    delay: prefersReducedMotion ? 0 : 0.6 + i * 0.08,
                    ease: entranceEase,
                  }}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{order.label}</p>
                    <p className="text-[11px] text-muted-foreground">{order.detail}</p>
                  </div>
                  <Badge
                    variant={order.variant as "default" | "secondary" | "info"}
                    className="text-[9px] normal-case tracking-normal"
                  >
                    {order.status}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default HeroDashboardMockup;
