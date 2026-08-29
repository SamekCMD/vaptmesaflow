import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-background py-20">
      <div className="container text-center">
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Operação pronta para ganhar clareza?
        </p>
        <h2 className="mb-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Comece com 3 dias grátis e veja o fluxo inteiro em um só painel
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-base text-muted-foreground">
          Sem fidelidade. Sem cartão no teste. Sem ruído entre salão, cozinha e caixa.
        </p>
        <Button asChild size="lg" className="h-11 px-8 text-base">
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
        <div className="mt-16 border-t border-border pt-8 text-sm text-muted-foreground">
          <a
            href="#"
            className="termly-display-preferences underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Consent Preferences
          </a>
          <p className="mt-4">© 2026 Vapt. Operação mais clara para restaurantes.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
