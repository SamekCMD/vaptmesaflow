import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCent,
  ClipboardList,
  Clock,
  DollarSign,
  ShoppingBag,
  Star,
  Store,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { OverviewSkeleton } from "@/components/skeletons/DashboardSkeletons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import OnboardingGuideCard from "@/components/dashboard/OnboardingGuideCard";
import {
  fetchOrderFeedbackRecords,
  type StoredOrderFeedbackRecord,
} from "@/lib/order-feedback";
import {
  EMPTY_GUIDE_PROGRESS,
  GUIDE_MODULES,
  completeGuideModule,
  getGuideModuleHref,
  getNextGuideModule,
  getRemainingGuideModules,
  GUIDE_MODULE_CONTENT,
  loadGuideProgress,
  saveGuideProgress,
  type OnboardingGuideProgress,
} from "@/lib/onboarding";

type Period = "day" | "week" | "month" | "year";

type OrderStatusSummary = {
  tone: "default" | "secondary" | "destructive" | "info";
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
};

type OverviewProps = {
  guideProgress?: OnboardingGuideProgress;
};

type SatisfactionSummary = {
  count: number;
  averageRating: number;
  promoterShare: number;
};

const periodLabels: Record<Period, string> = {
  day: "Hoje",
  week: "Semana",
  month: "Mês",
  year: "Ano",
};

const periodSummaryTitles: Record<Period, string> = {
  day: "Resumo de hoje",
  week: "Resumo da semana",
  month: "Resumo do mês",
  year: "Resumo do ano",
};

function getStartDate(period: Period): Date {
  const now = new Date();

  switch (period) {
    case "day":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
  }
}

interface OrderWithItems {
  id: string;
  display_id: number;
  total_price: number;
  status: string;
  created_at: string;
  updated_at: string | null;
  order_items: { product_name: string; quantity: number; unit_price: number }[];
}

const GUIDE_MODULE_LABELS: Record<keyof OnboardingGuideProgress, string> = {
  cashier: "Caixa",
  menu: "Cardápio",
  kitchen: "Cozinha",
  settings: "Configurações",
  overview: "Visão geral / métricas",
};

export function getGuideChecklistState(guideProgress: OnboardingGuideProgress) {
  const remainingGuideModules = getRemainingGuideModules(guideProgress);

  return {
    remainingGuideModules,
    showGuideChecklist: remainingGuideModules.length > 0,
  };
}

type OverviewGuideChecklistProps = {
  guideProgress: OnboardingGuideProgress;
};

export function OverviewGuideChecklist({ guideProgress }: OverviewGuideChecklistProps) {
  const { remainingGuideModules, showGuideChecklist } = useMemo(
    () => getGuideChecklistState(guideProgress),
    [guideProgress]
  );

  if (!showGuideChecklist) {
    return null;
  }

  return (
    <Card className="border-border/80">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">Próximos passos</CardTitle>
        <CardDescription>
          Continue o guia quando quiser. A lista some assim que tudo estiver concluído.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {GUIDE_MODULES.map((module) => {
          const complete = !remainingGuideModules.includes(module);

          return (
            <div
              key={module}
              className="flex items-center gap-3 rounded-md border border-border/70 bg-background px-3 py-2"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                  complete
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 text-muted-foreground"
                }`}
                aria-hidden="true"
              >
                {complete ? "✓" : "•"}
              </span>
              <span className="min-w-0 flex-1 text-sm text-foreground">{GUIDE_MODULE_LABELS[module]}</span>
              {complete ? (
                <span className="text-xs text-muted-foreground">Concluído</span>
              ) : (
                <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <Link to={getGuideModuleHref(module)}>Abrir</Link>
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function getOverviewSatisfactionSummary({
  feedbackRecords,
  restaurantId,
  periodStart,
  minRatings = 5,
}: {
  feedbackRecords: StoredOrderFeedbackRecord[];
  restaurantId: string;
  periodStart: Date;
  minRatings?: number;
}): SatisfactionSummary | null {
  // Sem volume mínimo, a média engana mais do que ajuda a operação.
  const relevantRecords = feedbackRecords.filter((record) => {
    if (record.restaurant_id !== restaurantId) return false;
    const createdAt = new Date(record.created_at);
    return !Number.isNaN(createdAt.getTime()) && createdAt >= periodStart;
  });

  if (relevantRecords.length < minRatings) {
    return null;
  }

  const totalRating = relevantRecords.reduce((sum, record) => sum + record.rating, 0);
  const promoterCount = relevantRecords.filter((record) => record.rating >= 4).length;

  return {
    count: relevantRecords.length,
    averageRating: totalRating / relevantRecords.length,
    promoterShare: Math.round((promoterCount / relevantRecords.length) * 100),
  };
}

const Overview = ({ guideProgress }: OverviewProps) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { refetch: refetchSub } = useSubscription();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [period, setPeriod] = useState<Period>("week");
  const [storedGuideProgress, setStoredGuideProgress] = useState<OnboardingGuideProgress>(() =>
    loadGuideProgress()
  );
  const [feedbackRecords, setFeedbackRecords] = useState<StoredOrderFeedbackRecord[]>([]);
  const effectiveGuideProgress = guideProgress ?? storedGuideProgress ?? EMPTY_GUIDE_PROGRESS;
  const guideMode = searchParams.get("guide") === "1";
  const guideNextModule = getNextGuideModule("overview");

  useEffect(() => {
    if (searchParams.get("subscribed") === "true") {
      toast({
        title: "Assinatura confirmada!",
        description: "Bem-vindo ao seu novo plano. Aproveite todos os recursos!",
      });
      refetchSub();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, refetchSub]);

  useEffect(() => {
    if (guideProgress) {
      setStoredGuideProgress(guideProgress);
      saveGuideProgress(guideProgress);
    }
  }, [guideProgress]);

  useEffect(() => {
    const syncGuideProgress = () => {
      setStoredGuideProgress(loadGuideProgress());
    };

    syncGuideProgress();
    window.addEventListener("storage", syncGuideProgress);
    window.addEventListener("focus", syncGuideProgress);
    window.addEventListener("onboarding-guide-progress-changed", syncGuideProgress);

    return () => {
      window.removeEventListener("storage", syncGuideProgress);
      window.removeEventListener("focus", syncGuideProgress);
      window.removeEventListener("onboarding-guide-progress-changed", syncGuideProgress);
    };
  }, [location.pathname, location.search]);

  const handleGuideComplete = () => {
    const nextProgress = completeGuideModule("overview", effectiveGuideProgress);
    setStoredGuideProgress(nextProgress);
    navigate(guideNextModule ? getGuideModuleHref(guideNextModule) : "/dashboard", { replace: true });
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        const { data: restData, error: restError } = await supabase
          .from("restaurants")
          .select("*")
          .eq("owner_id", user.id)
          .single();

        if (restError) throw restError;
        setRestaurant(restData);

        if (restData) {
          const periodStart = getStartDate(period);
          // Pedidos e satisfação precisam usar o mesmo recorte para o resumo fazer sentido.
          const [{ data: ordersData }, feedbackData] = await Promise.all([
            supabase
              .from("orders")
              .select("*, order_items(product_name, quantity, unit_price)")
              .eq("restaurant_id", restData.id)
              .gte("created_at", periodStart.toISOString())
              .order("created_at", { ascending: true }),
            fetchOrderFeedbackRecords({
              restaurantId: restData.id,
              periodStart,
            }).catch(() => []),
          ]);

          if (ordersData) setOrders(ordersData as unknown as OrderWithItems[]);
          setFeedbackRecords(feedbackData);
        }
      } catch (error: any) {
        toast({
          title: "Erro ao carregar dados",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, period]);

  const completedOrders = useMemo(
    () => orders.filter((o) => ["ready", "delivered"].includes(o.status)),
    [orders]
  );

  const totalRevenue = useMemo(
    () => completedOrders.reduce((sum, o) => sum + Number(o.total_price), 0),
    [completedOrders]
  );

  const pendingCount = useMemo(
    () => orders.filter((o) => ["pending", "preparing"].includes(o.status)).length,
    [orders]
  );

  const avgTicket = useMemo(
    () => (completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0),
    [completedOrders.length, totalRevenue]
  );

  const avgPrepTime = useMemo(() => {
    const times = completedOrders
      .filter((o) => o.updated_at)
      .map((o) => new Date(o.updated_at!).getTime() - new Date(o.created_at).getTime());

    if (times.length === 0) return null;

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return Math.round(avg / 60000);
  }, [completedOrders]);

  const topItems = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();

    completedOrders.forEach((order) =>
      order.order_items.forEach((item) => {
        const prev = map.get(item.product_name) || { qty: 0, revenue: 0 };
        map.set(item.product_name, {
          qty: prev.qty + item.quantity,
          revenue: prev.revenue + item.quantity * Number(item.unit_price),
        });
      })
    );

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty);
  }, [completedOrders]);

  const topByRevenue = useMemo(
    () => [...topItems].sort((a, b) => b.revenue - a.revenue),
    [topItems]
  );

  const periodSummary = useMemo(() => {
    if (pendingCount >= 8) {
      return {
        tone: "destructive",
        title: "A operação está pedindo reação rápida",
        body: "A fila de pedidos está alta para este momento. Vale abrir cozinha e caixa agora para evitar atrasos no atendimento.",
        ctaLabel: "Abrir cozinha",
        ctaHref: "/dashboard/kitchen",
      } satisfies OrderStatusSummary;
    }

    if (pendingCount > 0) {
      return {
        tone: "secondary",
        title: "O ritmo está bom, com pedidos em andamento",
        body: "Há movimento ativo no restaurante. O melhor próximo passo é acompanhar a fila e manter o tempo de preparo sob controle.",
        ctaLabel: "Ver pedidos em preparo",
        ctaHref: "/dashboard/kitchen",
      } satisfies OrderStatusSummary;
    }

    if (completedOrders.length > 0) {
      return {
        tone: "default",
        title: "Operação estável neste momento",
        body: "Sem pendências abertas agora. Este é um bom momento para revisar desempenho, ajustar o cardápio e preparar o próximo pico.",
        ctaLabel: "Ajustar cardápio",
        ctaHref: "/dashboard/menu",
      } satisfies OrderStatusSummary;
    }

    return {
      tone: "info",
      title: "Hora de preparar o restaurante para vender mais",
      body: "Ainda não há pedidos neste recorte. Aproveite para organizar cardápio, visual e fluxo de atendimento antes do próximo movimento.",
      ctaLabel: "Ir para cardápio",
      ctaHref: "/dashboard/menu",
    } satisfies OrderStatusSummary;
  }, [completedOrders.length, pendingCount]);

  const periodContext = useMemo(() => {
    if (pendingCount > 0) {
      return `${pendingCount} ${pendingCount === 1 ? "pedido precisa" : "pedidos precisam"} de atenção agora`;
    }

    if (completedOrders.length > 0) {
      return `${completedOrders.length} ${completedOrders.length === 1 ? "pedido concluído" : "pedidos concluídos"} neste recorte`;
    }

    return "Ainda sem movimento neste período";
  }, [completedOrders.length, pendingCount]);

  const periodSnapshotDescription = useMemo(() => {
    if (completedOrders.length > 0) {
      return `O que ${periodLabels[period].toLowerCase()} já gerou em vendas e pedidos concluídos.`;
    }

    if (pendingCount > 0) {
      return `O recorte de ${periodLabels[period].toLowerCase()} já tem fila em andamento, mesmo sem vendas concluídas.`;
    }

    return `Use este resumo para entender rapidamente como ${periodLabels[period].toLowerCase()} está se comportando.`;
  }, [completedOrders.length, pendingCount, period]);

  const primaryMetrics = [
    {
      title: "Faturamento no período",
      value: `R$ ${totalRevenue.toFixed(2).replace(".", ",")}`,
      helper: completedOrders.length > 0 ? periodContext : "Sem vendas fechadas até agora",
      icon: DollarSign,
    },
    {
      title: "Pedidos concluídos",
      value: `${completedOrders.length}`,
      helper: completedOrders.length > 0 ? "Pedidos já finalizados neste recorte" : "Aparece assim que as primeiras vendas fecharem",
      icon: TrendingUp,
    },
  ];

  const supportMetrics = [
    {
      title: "Pedidos em andamento",
      value: pendingCount.toString(),
      helper: pendingCount === 0 ? "Sem gargalos visíveis agora" : "Pedidos aguardando ação da equipe",
      icon: ClipboardList,
    },
    {
      title: "Ticket médio",
      value: `R$ ${avgTicket.toFixed(2).replace(".", ",")}`,
      helper: completedOrders.length > 0 ? "Média dos pedidos já concluídos" : "Sem base suficiente neste período",
      icon: BadgeCent,
    },
    {
      title: "Tempo médio",
      value: avgPrepTime !== null ? `${avgPrepTime} min` : "—",
      helper: avgPrepTime !== null ? "Da criação até a conclusão" : "Sem histórico suficiente para calcular",
      icon: Clock,
    },
  ];

  const satisfactionSummary = useMemo(
    () =>
      restaurant?.id
        ? getOverviewSatisfactionSummary({
            feedbackRecords,
            restaurantId: restaurant.id,
            periodStart: getStartDate(period),
            minRatings: 5,
          })
        : null,
    [feedbackRecords, period, restaurant?.id]
  );

  const operationalAlerts = useMemo(() => {
    const alerts: { title: string; description: string; href: string }[] = [];

    if (pendingCount >= 8) {
      alerts.push({
        title: "Fila alta de pedidos",
        description: `${pendingCount} pedidos pedem atenção agora. Vale abrir a cozinha e acompanhar o ritmo de preparo.`,
        href: "/dashboard/kitchen",
      });
    } else if (pendingCount > 0) {
      alerts.push({
        title: "Pedidos aguardando ação",
        description: `${pendingCount} ${pendingCount === 1 ? "pedido está em andamento" : "pedidos estão em andamento"} neste momento.`,
        href: "/dashboard/kitchen",
      });
    }

    if (completedOrders.length === 0 && pendingCount === 0) {
      alerts.push({
        title: "Sem movimento neste período",
        description: "Ainda não houve pedidos neste recorte. Revise cardápio e operação antes do próximo pico.",
        href: "/dashboard/menu",
      });
    }

    if (!restaurant?.payment_mode) {
      alerts.push({
        title: "Pagamento ainda não revisado",
        description: "Confira as configurações de pagamento para evitar bloqueios no atendimento.",
        href: "/dashboard/settings",
      });
    }

    return alerts.slice(0, 3);
  }, [completedOrders.length, pendingCount, restaurant?.payment_mode]);

  const chartData = useMemo(() => {
    if (period === "day") {
      const hours = Array.from({ length: 24 }, (_, i) => ({ label: `${i}h`, valor: 0 }));
      completedOrders.forEach((o) => {
        hours[new Date(o.created_at).getHours()].valor += Number(o.total_price);
      });
      return hours;
    }

    if (period === "week") {
      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const data = days.map((d) => ({ label: d, valor: 0 }));
      completedOrders.forEach((o) => {
        data[new Date(o.created_at).getDay()].valor += Number(o.total_price);
      });
      return data;
    }

    if (period === "month") {
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const data = Array.from({ length: daysInMonth }, (_, i) => ({ label: `${i + 1}`, valor: 0 }));
      completedOrders.forEach((o) => {
        const day = new Date(o.created_at).getDate() - 1;
        if (data[day]) data[day].valor += Number(o.total_price);
      });
      return data;
    }

    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const data = months.map((m) => ({ label: m, valor: 0 }));
    completedOrders.forEach((o) => {
      data[new Date(o.created_at).getMonth()].valor += Number(o.total_price);
    });
    return data;
  }, [completedOrders, period]);

  const { remainingGuideModules, showGuideChecklist } = useMemo(
    () => getGuideChecklistState(effectiveGuideProgress),
    [effectiveGuideProgress]
  );

  if (loading) return <OverviewSkeleton />;

  if (!restaurant) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-20 text-center">
        <Store className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-xl font-semibold tracking-tight">Nenhum restaurante encontrado</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Complete o processo de onboarding para configurar seu restaurante.
        </p>
        <Button onClick={() => navigate("/onboarding")}>Configurar restaurante</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-7">
      {guideMode && (
        <OnboardingGuideCard
          module="overview"
          title={GUIDE_MODULE_CONTENT.overview.title}
          description={GUIDE_MODULE_CONTENT.overview.description}
          nextHref={guideNextModule ? getGuideModuleHref(guideNextModule) : null}
          onComplete={handleGuideComplete}
        />
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="w-fit border-primary/20 bg-accent text-accent-foreground">
            Painel operacional
          </Badge>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{restaurant.name}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Uma leitura rápida do que merece atenção agora, com o desempenho do período logo abaixo.
            </p>
          </div>
        </div>

        <div
          className="inline-flex w-full flex-wrap gap-1 rounded-xl border border-border bg-card/80 p-1 sm:w-auto"
          role="group"
          aria-label="Filtrar período do dashboard"
        >
          {(Object.keys(periodLabels) as Period[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              aria-pressed={period === option}
              className={`min-h-11 flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 sm:min-w-[84px] sm:flex-none ${
                period === option
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              {periodLabels[option]}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-4 ${operationalAlerts.length > 0 ? "xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.9fr)]" : ""}`}>
        <Card className="border-border/80 bg-card/95">
          <CardContent className="p-5 sm:p-6">
            <div className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={periodSummary.tone} className="w-fit">
                      {periodLabels[period]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Resumo operacional</span>
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                      {periodSummary.title}
                    </h2>
                    <p className="max-w-2xl text-sm text-muted-foreground">{periodContext}</p>
                  </div>
                </div>

                <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-[420px]">
                  {primaryMetrics.map((metric) => (
                    <div key={metric.title} className="rounded-md border border-border/70 bg-background px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                          {metric.title}
                        </span>
                        <metric.icon className="h-4 w-4 text-primary/80" strokeWidth={1.75} />
                      </div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{metric.value}</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{metric.helper}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-xs leading-5 text-muted-foreground">
                  {periodSnapshotDescription}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="h-11 justify-between px-4">
                    <Link to={periodSummary.ctaHref}>
                      {periodSummary.ctaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 justify-between px-4">
                    <Link to="/dashboard/cashier">
                      Ver caixa
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {operationalAlerts.length > 0 && (
          <Card className="border-border/80">
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">Alertas e pendências</CardTitle>
              <CardDescription>
                Só aparece quando existe algo real para revisar agora.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {operationalAlerts.map((alert) => (
                <button
                  key={alert.title}
                  type="button"
                  onClick={() => navigate(alert.href)}
                  className="flex w-full items-start gap-3 rounded-lg border border-border/80 bg-background px-4 py-3 text-left transition-colors duration-150 hover:border-primary/30 hover:bg-accent/45"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <AlertTriangle className="h-4 w-4" strokeWidth={1.7} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">{alert.title}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.6} />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{alert.description}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        <OverviewGuideChecklist guideProgress={effectiveGuideProgress} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {supportMetrics.map((metric) => (
          <Card key={metric.title} className="border-border/80 bg-card/90">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {metric.title}
                </span>
                <metric.icon className="h-4 w-4 text-primary/80" strokeWidth={1.75} />
              </div>
              <div className="mt-3 text-[1.75rem] font-semibold tracking-tight text-foreground">{metric.value}</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{metric.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {satisfactionSummary && (
        <Card className="border-border/80">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-primary" strokeWidth={1.6} />
              Satisfação dos clientes
            </CardTitle>
            <CardDescription>
              Mostra só quando há pelo menos 5 avaliações no período selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border/70 bg-background px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Nota média
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {satisfactionSummary.averageRating.toFixed(1)}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-background px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Avaliações 4-5
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {satisfactionSummary.promoterShare}%
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-background px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Avaliações no período
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {satisfactionSummary.count}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card className="border-border/80">
          <CardHeader className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Faturamento ao longo de {periodLabels[period].toLowerCase()}</CardTitle>
                <CardDescription>
                  Ajuda a visualizar o ritmo de vendas sem roubar o foco da operação principal.
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit">
                {periodLabels[period]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `R$${v}`} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "10px",
                      fontSize: "12px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2).replace(".", ",")}`, "Faturamento"]}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-border/80">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-primary/85" strokeWidth={1.6} />
                Itens que mais giram
              </CardTitle>
              <CardDescription>
                Os campeões de saída ajudam a entender o que sustenta o caixa no dia a dia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topItems.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  Nenhum dado ainda. Assim que os pedidos começarem a sair, os itens mais pedidos aparecem aqui.
                </p>
              ) : (
                <div className="space-y-3">
                  {topItems.slice(0, 4).map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background px-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Badge variant="outline" className="h-7 w-7 justify-center rounded-full p-0 text-xs normal-case tracking-normal">
                          {index + 1}
                        </Badge>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.qty} pedidos no período</p>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-foreground">{item.qty}x</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-accent/30">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Star className="h-4 w-4 text-primary" strokeWidth={1.6} />
                Leitura rápida de margem
              </CardTitle>
              <CardDescription>
                Um bloco mais enxuto para destacar o que está trazendo mais receita neste recorte.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topByRevenue.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem faturamento suficiente neste período para destacar os itens mais rentáveis.
                </p>
              ) : (
                <div className="space-y-3">
                  {topByRevenue.slice(0, 3).map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Produto com melhor retorno neste recorte</p>
                      </div>
                      <span className="text-sm font-semibold text-primary">
                        R$ {item.revenue.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Overview;
