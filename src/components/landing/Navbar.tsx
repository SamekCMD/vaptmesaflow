import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Menu, X, Moon, Sun, LogIn } from "lucide-react";
import { useTheme } from "next-themes";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <nav className="fixed top-0 w-full z-50 hero-gradient border-b border-hero-muted/10 backdrop-blur-sm">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="text-xl font-bold text-hero-foreground">
          <span className="text-gradient">Vapt</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#funcionalidades" className="text-sm text-hero-muted hover:text-hero-foreground transition-colors">Funcionalidades</a>
          <Link to="/pricing" className="text-sm text-hero-muted hover:text-hero-foreground transition-colors">Planos</Link>
          <a href="#faq" className="text-sm text-hero-muted hover:text-hero-foreground transition-colors">FAQ</a>
          <button onClick={toggleTheme} className="text-hero-muted hover:text-hero-foreground transition-colors">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Button asChild variant="ghost" size="sm" className="text-hero-muted hover:text-hero-foreground">
            <Link to="/login"><LogIn className="h-4 w-4 mr-2" />Entrar</Link>
          </Button>
          <Button asChild size="sm" className="rounded-lg">
            <Link to="/signup">Começar Agora</Link>
          </Button>
        </div>

        {/* Mobile toggle */}
        <div className="md:hidden flex items-center gap-2">
          <button onClick={toggleTheme} className="text-hero-foreground p-2">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={() => setOpen(!open)} className="text-hero-foreground">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden hero-gradient border-t border-hero-muted/10 py-4">
          <div className="container flex flex-col gap-4">
            <a href="#funcionalidades" className="text-sm text-hero-muted" onClick={() => setOpen(false)}>Funcionalidades</a>
            <Link to="/pricing" className="text-sm text-hero-muted" onClick={() => setOpen(false)}>Planos</Link>
            <a href="#faq" className="text-sm text-hero-muted" onClick={() => setOpen(false)}>FAQ</a>
            <Link to="/login" className="text-sm text-hero-muted" onClick={() => setOpen(false)}>Entrar</Link>
            <Button asChild size="sm" className="w-fit rounded-lg">
              <Link to="/signup">Começar Agora</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
