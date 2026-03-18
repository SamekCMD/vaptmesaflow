import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Menu, X, LogIn } from "lucide-react";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="container flex items-center justify-between h-[52px]">
        <Link to="/" className="text-base font-semibold text-foreground">
          Vapt
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#funcionalidades" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">Funcionalidades</a>
          <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">Planos</Link>
          <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">FAQ</a>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link to="/login"><LogIn className="h-4 w-4 mr-2" strokeWidth={1.5} />Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">Começar Agora</Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <div className="md:hidden flex items-center gap-2">
          <button onClick={() => setOpen(!open)} className="text-foreground">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-background border-t border-border py-4">
          <div className="container flex flex-col gap-4">
            <a href="#funcionalidades" className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>Funcionalidades</a>
            <Link to="/pricing" className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>Planos</Link>
            <a href="#faq" className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>FAQ</a>
            <Link to="/login" className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>Entrar</Link>
            <Button asChild size="sm" className="w-fit">
              <Link to="/signup">Começar Agora</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
