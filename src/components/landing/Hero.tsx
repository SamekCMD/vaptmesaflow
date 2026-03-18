import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import HeroDashboardMockup from "./HeroDashboardMockup";

const Hero = () => {
  return (
    <section className="relative min-h-screen hero-gradient overflow-hidden flex items-center">
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
        backgroundSize: "60px 60px"
      }} />

      <div className="container relative z-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-brand-coral-muted px-4 py-1.5 text-sm text-primary mb-6">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Novo: Integração com WhatsApp via IA
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display tracking-tight text-foreground leading-[1.1] mb-6">
              Seu restaurante no{" "}
              <span className="text-gradient">piloto automático</span>
            </h1>

            <p className="text-lg text-text-secondary max-w-lg mb-8 leading-relaxed">
              Menu digital, gestão de cozinha em tempo real e atendimento via WhatsApp com IA — tudo integrado em uma única plataforma.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="text-base px-8 h-12 rounded-md glow font-display">
                <Link to="/signup">
                  Começar Agora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base px-8 h-12 rounded-md border-border text-foreground hover:bg-muted">
                <a href="#funcionalidades">Ver Funcionalidades</a>
              </Button>
            </div>

            <div className="flex items-center gap-6 mt-10 text-sm text-text-secondary">
              <span>✓ Setup em 5 minutos</span>
              <span>✓ Sem taxa de adesão</span>
              <span>✓ Suporte 24/7</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
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
