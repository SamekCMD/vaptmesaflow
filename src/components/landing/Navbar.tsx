import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Menu, X, LogIn, Flame } from "lucide-react";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 hero-gradient border-b border-border/60 backdrop-blur-sm">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-primary" />
          <span className="text-xl font-bold font-display text-foreground">Vapt</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#funcionalidades" className="text-sm text-text-secondary hover:text-foreground transition-colors">Funcionalidades</a>
          <Link to="/pricing" className="text-sm text-text-secondary hover:text-foreground transition-colors">Planos</Link>
          <a href="#faq" className="text-sm text-text-secondary hover:text-foreground transition-colors">FAQ</a>
          <Button asChild variant="ghost" size="sm" className="text-text-secondary hover:text-foreground">
            <Link to="/login"><LogIn className="h-4 w-4 mr-2" />Entrar</Link>
          </Button>
          <Button asChild size="sm" className="rounded-md font-display">
            <Link to="/signup">Começar Agora</Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <div className="md:hidden flex items-center gap-2">
          <button onClick={() => setOpen(!open)} className="text-foreground cursor-pointer">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden hero-gradient border-t border-border/60 py-4">
          <div className="container flex flex-col gap-4">
            <a href="#funcionalidades" className="text-sm text-text-secondary" onClick={() => setOpen(false)}>Funcionalidades</a>
            <Link to="/pricing" className="text-sm text-text-secondary" onClick={() => setOpen(false)}>Planos</Link>
            <a href="#faq" className="text-sm text-text-secondary" onClick={() => setOpen(false)}>FAQ</a>
            <Link to="/login" className="text-sm text-text-secondary" onClick={() => setOpen(false)}>Entrar</Link>
            <Button asChild size="sm" className="w-fit rounded-md font-display">
              <Link to="/signup">Começar Agora</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
