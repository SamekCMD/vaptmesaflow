import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Flame } from "lucide-react";

const Footer = () => {
  return (
    <footer className="hero-gradient py-20">
      <div className="container text-center">
        <h2 className="text-3xl sm:text-4xl font-bold font-display text-foreground mb-4">
          Pronto para transformar seu restaurante?
        </h2>
        <p className="text-text-secondary text-lg mb-8 max-w-lg mx-auto">
          Junte-se a centenas de restaurantes que já automatizaram sua operação com o Vapt.
        </p>
        <Button asChild size="lg" className="text-base px-8 h-12 rounded-md glow font-display">
          <Link to="/dashboard">
            Criar Conta Grátis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <div className="mt-16 pt-8 border-t border-border/30 flex items-center justify-center gap-2 text-text-tertiary text-sm">
          <Flame className="h-4 w-4 text-primary" />
          © 2026 Vapt. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
