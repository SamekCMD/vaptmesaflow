import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-background py-20">
      <div className="container text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4 tracking-tight">
          Pronto para transformar seu restaurante?
        </h2>
        <p className="text-muted-foreground text-base mb-8 max-w-lg mx-auto">
          Junte-se a centenas de restaurantes que já automatizaram sua operação com o Vapt.
        </p>
        <Button asChild size="lg" className="text-base px-8 h-11">
          <Link to="/dashboard">
            Criar Conta Grátis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <div className="mt-16 pt-8 border-t border-border text-muted-foreground text-sm">
          © 2026 Vapt. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
