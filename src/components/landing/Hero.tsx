import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Clock3, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import HeroDashboardMockup from "./HeroDashboardMockup";

const HERO_SUBTITLE_OPTIONS = [
  "Pedidos, faturamento e fila de preparo em uma única visão para agir antes do atraso aparecer.",
  "Do salão à cozinha, tudo no mesmo cockpit para você decidir rápido.",
  "Menos ruído na operação, mais clareza para vender bem no pico.",
  "Acompanhe pedidos e ritmo do restaurante sem trocar de tela o tempo todo.",
] as const;

const Hero = () => {
  const { user } = useAuth();
  const primaryHref = user ? "/dashboard" : "/signup";
  const [heroSubtitle, setHeroSubtitle] = useState<string>(HERO_SUBTITLE_OPTIONS[0]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = "vapt_landing_hero_subtitle";
    const stored = window.sessionStorage.getItem(storageKey);

    if (stored && HERO_SUBTITLE_OPTIONS.includes(stored as (typeof HERO_SUBTITLE_OPTIONS)[number])) {
      setHeroSubtitle(stored);
      return;
    }

    const randomSubtitle =
      HERO_SUBTITLE_OPTIONS[Math.floor(Math.random() * HERO_SUBTITLE_OPTIONS.length)];
    window.sessionStorage.setItem(storageKey, randomSubtitle);
    setHeroSubtitle(randomSubtitle);
  }, []);

  return (
    <section className="relative min-h-screen hero-gradient overflow-hidden flex items-center">
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container relative z-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Cockpit operacional em tempo real
            </div>

            <h1 className="max-w-xl text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground leading-[1.08] mb-6">
              Seu restaurante no piloto automático.
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl mb-8 leading-relaxed">
              {heroSubtitle}
            </p>

            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="text-base px-8 h-11">
                <Link to={primaryHref}>
                  Começar Agora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base px-8 h-11">
                <a href="#funcionalidades">Ver cockpit</a>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
                <Clock3 className="h-4 w-4 text-primary" />
                Setup em 5 minutos
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Operação confiável
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
                <BadgeCheck className="h-4 w-4 text-primary" />
                Suporte humano
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:block"
          >
            <HeroDashboardMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
