import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import TrialBanner from "@/components/dashboard/TrialBanner";
import PushNotificationBanner from "@/components/dashboard/PushNotificationBanner";
import { registerServiceWorker } from "@/lib/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Monitor,
  Settings,
  MessageCircle,
  Palette,
  Menu,
  X,
  Bell,
  ChevronDown,
  LogOut,
  Banknote,
  CreditCard,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { title: "Visão Geral", icon: LayoutDashboard, path: "/dashboard" },
  { title: "Cardápio", icon: UtensilsCrossed, path: "/dashboard/menu" },
  { title: "Cozinha (KDS)", icon: Monitor, path: "/dashboard/kitchen" },
  { title: "Caixa", icon: Banknote, path: "/dashboard/cashier" },
  { title: "Aparência", icon: Palette, path: "/dashboard/appearance" },
  { title: "WhatsApp", icon: MessageCircle, path: "/dashboard/whatsapp" },
  { title: "Assinatura", icon: CreditCard, path: "/dashboard/subscription" },
  { title: "Configurações", icon: Settings, path: "/dashboard/settings" },
];

const planBadgeStyles: Record<string, string> = {
  trial: "bg-muted text-muted-foreground border-border",
  starter: "bg-secondary text-secondary-foreground border-border",
  pro: "bg-brand-coral-muted text-primary border-primary/30",
  business: "bg-brand-gold-muted text-brand-gold border-brand-gold/30",
};

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isActive, loading: planLoading, planType, isTrialing, trialDaysLeft } = useSubscription();

  // Register service worker and fetch restaurant ID
  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("restaurants").select("id").eq("owner_id", user.id).single().then(({ data }) => {
      if (data) setRestaurantId(data.id);
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

  const badgeStyle = planBadgeStyles[planType] || planBadgeStyles.trial;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[220px] bg-secondary border-r border-border/60 transform transition-transform lg:translate-x-0 lg:static flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-[52px] px-5 border-b border-border/60">
          <Link to="/" className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold font-display text-foreground">Vapt</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="p-3 space-y-0.5 flex-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150 cursor-pointer ${
                  active
                    ? "bg-muted text-foreground border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        {/* Plan badge */}
        <div className="p-3 border-t border-border/60">
          <Link to="/dashboard/subscription">
            <Badge
              variant="outline"
              className={`w-full justify-center py-1.5 text-[11px] font-mono uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity ${badgeStyle}`}
            >
              {badgeLabel}
            </Badge>
          </Link>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-[52px] border-b border-border/60 bg-background flex items-center justify-between px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-foreground cursor-pointer">
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:block font-display text-[15px] font-medium text-foreground" />

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative h-8 w-8">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 cursor-pointer">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-muted text-foreground text-xs font-display">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden sm:block text-foreground">{fullName}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto space-y-4">
          <PushNotificationBanner restaurantId={restaurantId} />
          <TrialBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
