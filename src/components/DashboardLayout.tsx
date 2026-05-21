import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useTheme } from "@/hooks/useTheme";
import TrialBanner from "@/components/dashboard/TrialBanner";
import PushNotificationBanner from "@/components/dashboard/PushNotificationBanner";
import { registerServiceWorker } from "@/lib/push-notifications";
import { fetchOwnedRestaurant } from "@/lib/restaurants";
import { Switch } from "@/components/ui/switch";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Monitor,
  Settings,
  Palette,
  Menu,
  X,
  Bell,
  ChevronDown,
  LogOut,
  Banknote,
  Sun,
  Moon,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { title: "Visão Geral", icon: LayoutDashboard, path: "/dashboard" },
  { title: "Cardápio", icon: UtensilsCrossed, path: "/dashboard/menu" },
  { title: "Cozinha (KDS)", icon: Monitor, path: "/dashboard/kitchen" },
  { title: "Caixa", icon: Banknote, path: "/dashboard/cashier" },
  { title: "Aparência", icon: Palette, path: "/dashboard/appearance" },
];

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isActive, loading: planLoading, planType, isTrialing, trialDaysLeft } = useSubscription();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchOwnedRestaurant<{ id: string; slug: string; owner_id: string; updated_at: string }>(
      user.id,
      "id, slug, owner_id, updated_at",
    ).then((data) => {
      if (data) {
        setRestaurantId(data.id);
        setRestaurantSlug(data.slug);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!planLoading && !isActive && !location.pathname.includes("/settings") && !location.pathname.includes("/subscription")) {
      navigate("/dashboard/subscription");
    }
  }, [planLoading, isActive, location.pathname, navigate]);

  const fullName = user?.user_metadata?.full_name || "Usuário";
  const initials = fullName
    .split(" ")
    .map((n: string) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const badgeLabel = isTrialing
    ? `Trial · ${trialDaysLeft}d`
    : planType === "trial"
    ? "Trial"
    : planType.charAt(0).toUpperCase() + planType.slice(1);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[220px] bg-background border-r border-border transform transition-transform lg:translate-x-0 lg:static flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navegação principal do dashboard"
      >
        <div className="flex items-center justify-between h-[56px] px-5 border-b border-border">
          <Link to="/" className="text-base font-semibold text-foreground">Vapt</Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden min-h-11 min-w-11 text-muted-foreground"
            aria-label="Fechar menu lateral"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="p-3 space-y-0.5 flex-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150 ${
                  active
                    ? "bg-secondary text-foreground border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" strokeWidth={1.5} />
                {item.title}
              </Link>
            );
          })}
        </nav>

        {/* Plan badge */}
        <div className="p-3 border-t border-border">
          <Link to="/dashboard/subscription">
            <Badge
              variant="outline"
              className="w-full justify-center py-1.5 text-[11px] cursor-pointer hover:opacity-80 transition-opacity"
            >
              {badgeLabel}
            </Badge>
          </Link>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-background/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="min-h-[56px] border-b border-border bg-background flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden min-h-11 min-w-11 text-foreground"
            aria-label="Abrir menu lateral"
            type="button"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-11 w-11"
              aria-label="Notificações"
              type="button"
            >
              <Bell className="h-4 w-4" strokeWidth={1.5} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex min-h-11 items-center gap-2 rounded-md px-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Abrir menu da conta"
                  type="button"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-secondary text-muted-foreground text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-[13px] font-medium hidden sm:block">{fullName}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px]">
                {/* User info */}
                <DropdownMenuLabel className="font-normal px-3 py-2.5">
                  <div className="text-[13px] font-medium text-foreground">{fullName}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{user?.email}</div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {/* Theme toggle */}
                <div
                  className="flex min-h-11 items-center justify-between px-3 py-2 cursor-pointer rounded-sm hover:bg-muted transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleTheme();
                  }}
                  role="button"
                  aria-label={`Ativar ${theme === "light" ? "modo escuro" : "modo claro"}`}
                >
                  <div className="flex items-center gap-2">
                    {theme === 'light' ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-[13px]">{theme === 'light' ? 'Modo Claro' : 'Modo Escuro'}</span>
                  </div>
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                    className="scale-75"
                  />
                </div>

                <DropdownMenuSeparator />

                {/* Navigation items */}
                <DropdownMenuItem onClick={() => navigate("/dashboard/subscription")} className="px-3 py-2 text-[13px] gap-2">
                  <CreditCard className="h-4 w-4" />
                  Assinatura
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard/settings")} className="px-3 py-2 text-[13px] gap-2">
                  <Settings className="h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
                {restaurantSlug && (
                  <DropdownMenuItem onClick={() => window.open(`/menu/${restaurantSlug}`, '_blank')} className="px-3 py-2 text-[13px] gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Ver Cardápio
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {/* Logout */}
                <DropdownMenuItem onClick={handleLogout} className="px-3 py-2 text-[13px] gap-2 text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto space-y-6">
          <PushNotificationBanner restaurantId={restaurantId} />
          <TrialBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
