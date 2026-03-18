import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Clock,
  Store,
  Trophy,
  Star,
} from "lucide-react";
import { OverviewSkeleton } from "@/components/skeletons/DashboardSkeletons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";

type Period = "day" | "week" | "month" | "year";

const periodLabels: Record<Period, string> = {
  day: "Hoje",
  week: "Semana",
  month: "Mês",
  year: "Ano",
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

const Overview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { refetch: refetchSub } = useSubscription();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [period, setPeriod] = useState<Period>("week");

  // Post-payment detection
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
    const fetchData = async () => {
      if (!user) return;
      try {
        const { data: restData, error: restError } = await supabase
          .from("restaurants")
          .select("*")
          .eq("owner_id", user.id)
          .single();

        if (restError) throw restError;
        setRestaurant(restData);

        if (restData) {
          const { data: ordersData } = await supabase
            .from("orders")
            .select("*, order_items(product_name, quantity, unit_price)")
            .eq("restaurant_id", restData.id)
            .gte("created_at", getStartDate("year").toISOString())
            .order("created_at", { ascending: true });

          if (ordersData) setOrders(ordersData as unknown as OrderWithItems[]);
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
  }, [user]);

  const filteredOrders = useMemo(() => {
    const start = getStartDate(period);
    return orders.filter((o) => new Date(o.created_at) >= start);
  }, [orders, period]);

  const completedOrders = useMemo(
    () => filteredOrders.filter((o) => ["ready", "delivered"].includes(o.status)),
    [filteredOrders]
  );

  const totalRevenue = useMemo(
    () => completedOrders.reduce((sum, o) => sum + Number(o.total_price), 0),
    [completedOrders]
  );

  const pendingCount = useMemo(
    () => filteredOrders.filter((o) => ["pending", "preparing"].includes(o.status)).length,
    [filteredOrders]
  );

  const avgTicket = useMemo(
    () => (completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0),
    [totalRevenue, completedOrders]
  );

  const avgPrepTime = useMemo(() => {
    const last24h = Date.now() - 86400000;
    const times = completedOrders
      .filter((o) => o.updated_at && new Date(o.created_at).getTime() >= last24h)
      .map((o) => new Date(o.updated_at!).getTime() - new Date(o.created_at).getTime());
    if (times.length === 0) return null;
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return Math.round(avg / 60000);
  }, [completedOrders]);

  const topItems = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    completedOrders.forEach((o) =>
      o.order_items.forEach((item) => {
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

  const chartData = useMemo(() => {
    if (period === "day") {
      const hours = Array.from({ length: 24 }, (_, i) => ({ label: `${i}h`, valor: 0 }));
      completedOrders.forEach((o) => { hours[new Date(o.created_at).getHours()].valor += Number(o.total_price); });
      return hours;
    }
    if (period === "week") {
      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const data = days.map((d) => ({ label: d, valor: 0 }));
      completedOrders.forEach((o) => { data[new Date(o.created_at).getDay()].valor += Number(o.total_price); });
      return data;
    }
    if (period === "month") {
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const data = Array.from({ length: daysInMonth }, (_, i) => ({ label: `${i + 1}`, valor: 0 }));
      completedOrders.forEach((o) => { const day = new Date(o.created_at).getDate() - 1; if (data[day]) data[day].valor += Number(o.total_price); });
      return data;
    }
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const data = months.map((m) => ({ label: m, valor: 0 }));
    completedOrders.forEach((o) => { data[new Date(o.created_at).getMonth()].valor += Number(o.total_price); });
    return data;
  }, [completedOrders, period]);

  if (loading) return <OverviewSkeleton />;

  if (!restaurant) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <Store className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-xl font-semibold tracking-tight">Nenhum restaurante encontrado</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Complete o processo de onboarding para configurar seu restaurante.
        </p>
        <Button onClick={() => navigate("/onboarding")}>Configurar Restaurante</Button>
      </div>
    );
  }

  const metricCards = [
    { title: "FATURAMENTO", value: `R$ ${totalRevenue.toFixed(2).replace(".", ",")}`, sub: `${completedOrders.length} pedidos concluídos`, icon: DollarSign },
    { title: "PEDIDOS PENDENTES", value: String(pendingCount), sub: pendingCount === 0 ? "Tudo em dia!" : "Aguardando ação", icon: ShoppingBag },
    { title: "TICKET MÉDIO", value: `R$ ${avgTicket.toFixed(2).replace(".", ",")}`, sub: completedOrders.length > 0 ? "Por pedido concluído" : "Sem dados", icon: TrendingUp },
    { title: "TEMPO MÉDIO", value: avgPrepTime !== null ? `${avgPrepTime} min` : "— min", sub: "Preparação + entrega", icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{restaurant.name}</h1>
          <p className="text-muted-foreground text-sm">Resumo do seu restaurante</p>
        </div>
        <div className="flex gap-1 bg-card border border-border rounded-md p-1">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors duration-150 ${
                period === p ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((m) => (
          <Card key={m.title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] uppercase tracking-[0.08em] font-medium text-[hsl(240_2%_34%)]">{m.title}</span>
                <m.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-[28px] font-medium font-mono tracking-tight">{m.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Faturamento — {periodLabels[period]}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2).replace(".", ",")}`, "Faturamento"]}
                />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Items */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-[hsl(44_51%_54%)]" strokeWidth={1.5} />
              Mais Pedidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dado ainda</p>
            ) : (
              <div className="space-y-3">
                {topItems.slice(0, 5).map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="h-6 w-6 flex items-center justify-center p-0 text-xs font-medium normal-case tracking-normal">
                        {i + 1}
                      </Badge>
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground font-mono">{item.qty}x</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" strokeWidth={1.5} />
              Mais Rentáveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topByRevenue.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dado ainda</p>
            ) : (
              <div className="space-y-3">
                {topByRevenue.slice(0, 5).map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="h-6 w-6 flex items-center justify-center p-0 text-xs font-medium normal-case tracking-normal">
                        {i + 1}
                      </Badge>
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium font-mono text-primary">
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
  );
};

export default Overview;
