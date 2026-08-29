import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Bell, BellOff, Clock, Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { KitchenSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { fetchOwnedRestaurant } from "@/lib/restaurants";
import { useNavigate, useSearchParams } from "react-router-dom";
import OnboardingGuideCard from "@/components/dashboard/OnboardingGuideCard";
import {
  completeGuideModule,
  getGuideModuleHref,
  getNextGuideModule,
  GUIDE_MODULE_CONTENT,
} from "@/lib/onboarding";

const playDoubleBeep = () => {
  try {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const playBeep = (startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    };
    playBeep(ctx.currentTime);
    playBeep(ctx.currentTime + 0.35);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[KitchenMonitor] could not play notification sound", error);
    }
  }
};

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  notes: string;
}

interface Order {
  id: string;
  display_id: number;
  table_number: string | null;
  total_price: number;
  status: "paid" | "pending" | "preparing" | "ready";
  order_channel?: "local" | "delivery" | null;
  payment_status: string | null;
  created_at: string;
  updated_at: string | null;
  order_items: OrderItem[];
}

type ColumnKey = "pending" | "preparing" | "ready";

const columns: Array<{
  key: ColumnKey;
  label: string;
  dotColor: string;
  panelClass: string;
}> = [
  {
    key: "pending",
    label: "Na Fila",
    dotColor: "bg-[hsl(44_51%_54%)]",
    panelClass: "border-[hsl(44_51%_54%/0.25)] bg-[hsl(44_51%_54%/0.035)]",
  },
  {
    key: "preparing",
    label: "Preparando",
    dotColor: "bg-[hsl(216_34%_64%)]",
    panelClass: "border-[hsl(216_34%_64%/0.25)] bg-[hsl(216_34%_64%/0.035)]",
  },
  {
    key: "ready",
    label: "Prontos",
    dotColor: "bg-primary",
    panelClass: "border-primary/20 bg-primary/[0.025]",
  },
];

const nextStatus: Record<string, string> = {
  paid: "preparing",
  pending: "preparing",
  preparing: "ready",
};

const actionLabels: Record<string, string> = {
  paid: "Preparar",
  pending: "Preparar",
  preparing: "Finalizar",
};

const isOrderInColumn = (order: Order, columnKey: ColumnKey) => {
  if (columnKey === "pending") {
    return order.status === "paid" || order.status === "pending";
  }

  return order.status === columnKey;
};

const getTimerDisplay = (order: Order, isReady: boolean) => {
  const now = Date.now();
  const start = new Date(order.created_at).getTime();
  const end = isReady && order.updated_at ? new Date(order.updated_at).getTime() : now;
  const elapsedSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const display = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  let borderClass: string;
  let textClass: string;

  if (minutes < 10) {
    borderClass = "border-border";
    textClass = "text-[hsl(153_33%_52%)]";
  } else if (minutes < 20) {
    borderClass = "border-[hsl(44_51%_54%/0.7)]";
    textClass = "text-[hsl(44_51%_46%)]";
  } else {
    borderClass = "border-destructive/60";
    textClass = "text-destructive";
  }

  return { display, borderClass, textClass };
};

const KitchenMonitor = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<"all" | "local" | "delivery">("all");
  const [mobileColumn, setMobileColumn] = useState<ColumnKey>("pending");
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem("vapt_kds_sound_enabled");
    return stored !== null ? stored === "true" : true;
  });
  const [, setTick] = useState(0);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("vapt_kds_sound_enabled", String(next));
      return next;
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      setOrders((prev) => {
        const now = Date.now();
        const toArchive = prev.filter(
          (o) => o.status === "ready" && o.updated_at && now - new Date(o.updated_at).getTime() > 60000,
        );
        if (toArchive.length > 0) {
          toArchive.forEach((o) => {
            supabase.from("orders").update({ status: "delivered" }).eq("id", o.id).then(() => {});
          });
          return prev.filter((o) => !toArchive.find((a) => a.id === o.id));
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchRestaurant = async () => {
      const data = await fetchOwnedRestaurant<{ id: string; owner_id: string; updated_at: string }>(
        user.id,
        "id, owner_id, updated_at",
      );
      if (data) setRestaurantId(data.id);
    };
    fetchRestaurant();
  }, [user]);

  const guideMode = searchParams.get("guide") === "1";
  const guideNextModule = getNextGuideModule("kitchen");

  const handleGuideComplete = () => {
    completeGuideModule("kitchen");
    navigate(guideNextModule ? getGuideModuleHref(guideNextModule) : "/dashboard", { replace: true });
  };

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("restaurant_id", restaurantId)
      .in("status", ["paid", "pending", "preparing", "ready"])
      .order("created_at", { ascending: false });

    if (data) {
      const fetched = data as unknown as Order[];
      if (knownOrderIdsRef.current.size > 0 && soundEnabled) {
        const newOrders = fetched.filter(
          (o) => !knownOrderIdsRef.current.has(o.id) && o.payment_status === "CONFIRMED",
        );
        if (newOrders.length > 0) {
          playDoubleBeep();
          toast({ title: `${newOrders.length} novo(s) pedido(s)!`, description: "Novos pedidos foram recebidos." });
        }
      }
      knownOrderIdsRef.current = new Set(fetched.map((o) => o.id));
      setOrders(fetched);
    }
    setLoading(false);
  }, [restaurantId, soundEnabled]);

  useEffect(() => {
    if (restaurantId) fetchOrders();
  }, [restaurantId, fetchOrders]);

  useEffect(() => {
    if (!restaurantId) return;
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [restaurantId, fetchOrders]);

  const advance = async (order: Order) => {
    const next = nextStatus[order.status];
    if (!next) return;

    setUpdatingOrderId(order.id);
    const previousStatus = order.status;
    const previousUpdatedAt = order.updated_at;
    const optimisticUpdatedAt = new Date().toISOString();

    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? { ...o, status: next as Order["status"], updated_at: optimisticUpdatedAt }
          : o,
      ),
    );

    const { error } = await supabase.from("orders").update({ status: next }).eq("id", order.id);
    setUpdatingOrderId(null);

    if (error) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, status: previousStatus, updated_at: previousUpdatedAt } : o,
        ),
      );
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: `Pedido #${order.display_id} atualizado`,
      description: `Movido para "${columns.find((c) => c.key === next)?.label ?? "Próxima etapa"}"`,
    });
  };

  if (loading) return <KitchenSkeleton />;

  const getOrderChannel = (order: Order): "local" | "delivery" =>
    order.order_channel === "delivery" ? "delivery" : "local";

  const getOrdersByFilter = (list: Order[]) => {
    if (channelFilter === "all") return list;
    return list.filter((order) => getOrderChannel(order) === channelFilter);
  };

  const localCount = orders.filter((order) => getOrderChannel(order) === "local").length;
  const deliveryCount = orders.filter((order) => getOrderChannel(order) === "delivery").length;
  const allCount = orders.length;
  const filteredOrders = getOrdersByFilter(orders);

  const columnOrders = (key: ColumnKey) => filteredOrders.filter((order) => isOrderInColumn(order, key));

  const renderOrderCard = (order: Order, columnKey: ColumnKey) => {
    const isReady = columnKey === "ready";
    const timer = getTimerDisplay(order, isReady);
    const isUpdating = updatingOrderId === order.id;
    const next = nextStatus[order.status];
    const canAdvance = Boolean(next) && !isUpdating && !isReady;
    const orderChannel = getOrderChannel(order);
    const visibleItems = order.order_items.slice(0, 4);
    const hiddenItems = Math.max(0, order.order_items.length - visibleItems.length);

    return (
      <Card
        key={order.id}
        data-testid={`kds-order-card-${order.id}`}
        className={`${timer.borderClass} bg-card shadow-sm transition-shadow`}
      >
        <CardContent className="p-3 sm:p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-semibold leading-none">#{order.display_id}</span>
                <Badge
                  variant={orderChannel === "delivery" ? "default" : "outline"}
                  className="h-5 px-1.5 text-[10px] normal-case tracking-normal"
                >
                  {orderChannel === "delivery" ? "Delivery" : "Local"}
                </Badge>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {order.table_number ? `Mesa ${order.table_number}` : "Sem mesa"}
              </div>
            </div>

            <div className={`flex shrink-0 items-center gap-1 font-mono text-xs font-semibold ${timer.textClass}`}>
              <Clock className="h-3.5 w-3.5" strokeWidth={1.7} />
              {timer.display}
            </div>
          </div>

          <div className="my-3 border-t border-border/70" />

          <ul className="space-y-1">
            {visibleItems.map((item) => (
              <li key={item.id} className="text-[13px] leading-snug text-foreground">
                <span className="font-semibold">{item.quantity}×</span> {item.product_name}
                {item.notes ? (
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {item.notes}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>

          {hiddenItems > 0 ? (
            <div className="mt-2 text-[11px] font-medium text-muted-foreground">+ {hiddenItems} item(ns)</div>
          ) : null}

          {canAdvance ? (
            <Button
              type="button"
              onClick={() => advance(order)}
              disabled={isUpdating}
              aria-label={`${actionLabels[order.status]} pedido #${order.display_id}`}
              className="mt-3 h-11 w-full touch-manipulation justify-between px-3 text-sm font-semibold sm:h-12"
            >
              <span className="flex items-center gap-2">
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {actionLabels[order.status]}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : isReady ? (
            <div className="mt-3 flex h-10 items-center justify-center rounded-md border border-primary/20 bg-primary/5 text-xs font-semibold text-primary">
              Pronto para retirada
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  const renderColumn = (key: ColumnKey, mobile = false) => {
    const column = columns.find((item) => item.key === key)!;
    const items = columnOrders(key);
    const queueGrid = key === "pending" && !mobile ? "min-[1450px]:grid-cols-2" : "";

    return (
      <section
        key={column.key}
        className={`flex min-h-0 flex-col overflow-hidden rounded-xl border ${column.panelClass}`}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/70 px-3">
          <div className={`h-2.5 w-2.5 rounded-full ${column.dotColor}`} />
          <h2 className="text-sm font-semibold">{column.label}</h2>
          <Badge variant="outline" className="ml-auto h-6 min-w-6 justify-center px-1.5 text-[11px]">
            {items.length}
          </Badge>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5 [scrollbar-gutter:stable]">
          {items.length > 0 ? (
            <div className={`grid grid-cols-1 gap-2.5 ${queueGrid}`}>
              {items.map((order) => renderOrderCard(order, key))}
            </div>
          ) : (
            <div className="flex h-full min-h-36 items-center justify-center text-center text-xs text-muted-foreground">
              Nenhum pedido
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-4">
      {guideMode && (
        <OnboardingGuideCard
          module="kitchen"
          title={GUIDE_MODULE_CONTENT.kitchen.title}
          description={GUIDE_MODULE_CONTENT.kitchen.description}
          nextHref={guideNextModule ? getGuideModuleHref(guideNextModule) : null}
          onComplete={handleGuideComplete}
        />
      )}

      <div className="flex shrink-0 flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Monitor da Cozinha</h1>
          <p className="text-sm text-muted-foreground">Acompanhe os pedidos em tempo real</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={soundEnabled ? "outline" : "ghost"}
            size="icon"
            onClick={toggleSound}
            title={soundEnabled ? "Som ativado" : "Som desativado"}
            aria-label={soundEnabled ? "Desativar som do KDS" : "Ativar som do KDS"}
            className="h-11 w-11 touch-manipulation"
          >
            {soundEnabled ? (
              <Bell className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <BellOff className="h-4 w-4" strokeWidth={1.5} />
            )}
          </Button>
          <Button
            variant="outline"
            onClick={fetchOrders}
            className="h-11 touch-manipulation px-4"
          >
            <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={channelFilter === "all" ? "default" : "outline"}
          onClick={() => setChannelFilter("all")}
          className="h-11 min-w-[104px] touch-manipulation justify-center px-3"
        >
          Todos <span className="ml-1.5 opacity-70">{allCount}</span>
        </Button>
        <Button
          type="button"
          variant={channelFilter === "local" ? "default" : "outline"}
          onClick={() => setChannelFilter("local")}
          className="h-11 min-w-[104px] touch-manipulation justify-center px-3"
        >
          Local <span className="ml-1.5 opacity-70">{localCount}</span>
        </Button>
        <Button
          type="button"
          variant={channelFilter === "delivery" ? "default" : "outline"}
          onClick={() => setChannelFilter("delivery")}
          className="h-11 min-w-[104px] touch-manipulation justify-center px-3"
        >
          Delivery <span className="ml-1.5 opacity-70">{deliveryCount}</span>
        </Button>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-1 rounded-lg border bg-muted/30 p-1 md:hidden">
        {columns.map((column) => {
          const active = mobileColumn === column.key;
          return (
            <button
              key={column.key}
              type="button"
              onClick={() => setMobileColumn(column.key)}
              className={`flex min-h-12 touch-manipulation items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors ${
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${column.dotColor}`} />
              <span className="truncate">{column.label}</span>
              <span className="font-mono text-[10px] opacity-70">{columnOrders(column.key).length}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[500px] flex-1 md:hidden">
        {renderColumn(mobileColumn, true)}
      </div>

      <div className="hidden min-h-[520px] flex-1 gap-3 md:grid md:grid-cols-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {columns.map((column) => renderColumn(column.key))}
      </div>
    </div>
  );
};

export default KitchenMonitor;
