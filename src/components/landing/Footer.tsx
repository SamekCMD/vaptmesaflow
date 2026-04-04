import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-background py-20">
      <div className="container text-center">
        <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-4">
          Operação pronta para ganhar clareza?
        </p>
        <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4 tracking-tight">
          Comece com 3 dias grátis e veja o fluxo inteiro em um só painel
        </h2>
        <p className="text-muted-foreground text-base mb-8 max-w-2xl mx-auto">
          Sem fidelidade. Sem cartão no teste. Sem ruído entre salão, cozinha e caixa.
        </p>
        <Button asChild size="lg" className="text-base px-8 h-11">
          <Link to="/dashboard">
            Criar conta grátis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5">
            Setup em minutos
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5">
            Suporte humano
          </span>
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1.5">
            Cancelamento livre
          </span>
        </div>
        <div className="mt-16 pt-8 border-t border-border text-muted-foreground text-sm">
          © 2026 Vapt. Operação mais clara para restaurantes.
        </div>
      </div>
    </footer>
  );
};

export default Footer;