import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 hero-gradient border-b border-hero-muted/10 backdrop-blur-sm">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="text-xl font-bold text-hero-foreground">
          <span className="text-gradient">Vapt</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#funcionalidades" className="text-sm text-hero-muted hover:text-hero-foreground transition-colors">Funcionalidades</a>
          <a href="#planos" className="text-sm text-hero-muted hover:text-hero-foreground transition-colors">Planos</a>
          <a href="#faq" className="text-sm text-hero-muted hover:text-hero-foreground transition-colors">FAQ</a>
          <Button asChild size="sm" className="rounded-lg">
            <Link to="/dashboard">Começar Agora</Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="md:hidden text-hero-foreground">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden hero-gradient border-t border-hero-muted/10 py-4">
          <div className="container flex flex-col gap-4">
            <a href="#funcionalidades" className="text-sm text-hero-muted" onClick={() => setOpen(false)}>Funcionalidades</a>
            <a href="#planos" className="text-sm text-hero-muted" onClick={() => setOpen(false)}>Planos</a>
            <a href="#faq" className="text-sm text-hero-muted" onClick={() => setOpen(false)}>FAQ</a>
            <Button asChild size="sm" className="w-fit rounded-lg">
              <Link to="/dashboard">Começar Agora</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
