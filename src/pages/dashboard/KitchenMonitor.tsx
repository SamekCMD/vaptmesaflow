import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight, RefreshCw, Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { KitchenSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const playDoubleBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  } catch {}
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
  payment_status: string | null;
  created_at: string;
  updated_at: string | null;
  order_items: OrderItem[];
}

const columns = [
  { key: "paid" as const, label: "Pagos (Novos)", color: "bg-emerald-500" },
  { key: "pending" as const, label: "Na Fila", color: "bg-yellow-500" },
  { key: "preparing" as const, label: "Preparando", color: "bg-blue-500" },
  { key: "ready" as const, label: "Prontos", color: "bg-green-500" },
];

const nextStatus: Record<string, string> = {
  paid: "pending",
  pending: "preparing",
  preparing: "ready",
};

const actionLabels: Record<string, string> = {
  paid: "Aceitar",
  pending: "Preparar",
  preparing: "Finalizar",
};

const getTimerDisplay = (order: Order, isReady: boolean) => {
  const now = Date.now();
  const start = new Date(order.created_at).getTime();
  const end = isReady && order.updated_at ? new Date(order.updated_at).getTime() : now;
  const elapsedSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const display = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  let bgColor: string;
  let textColor: string;

  if (minutes < 10) {
    bgColor = "#DCFCE7";
    textColor = "#166534";
  } else if (minutes < 20) {
    bgColor = "#FEF9C3";
    textColor = "#713F12";
  } else {
    bgColor = "#FEE2E2";
    textColor = "#991B1B";
  }

  return { display, bgColor, textColor };
};

const KitchenMonitor = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
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

  // Refresh every 1s for timer + auto-archive ready orders after 1 min
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);

      setOrders((prev) => {
        const now = Date.now();
        const toArchive = prev.filter(
          (o) =>
            o.status === "ready" &&
            o.updated_at &&
            now - new Date(o.updated_at).getTime() > 60000
        );

        if (toArchive.length > 0) {
          toArchive.forEach((o) => {
            supabase
              .from("orders")
              .update({ status: "delivered" })
              .eq("id", o.id)
              .then(() => {});
          });
          return prev.filter((o) => !toArchive.find((a) => a.id === o.id));
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get restaurant_id
  useEffect(() => {
    if (!user) return;
    const fetchRestaurant = async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .single();
      if (data) setRestaurantId(data.id);
    };
    fetchRestaurant();
  }, [user]);

  // Fetch orders with new-order detection
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
          (o) =>
            !knownOrderIdsRef.current.has(o.id) &&
            o.payment_status === "CONFIRMED"
        );
        if (newOrders.length > 0) {
          playDoubleBeep();
          toast({
            title: `🔔 ${newOrders.length} novo(s) pedido(s)!`,
            description: "Novos pedidos foram recebidos.",
          });
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

  // Polling every 5 seconds
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

    // Optimistic update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? { ...o, status: next as Order["status"], updated_at: new Date().toISOString() }
          : o
      )
    );

    const { error } = await supabase
      .from("orders")
      .update({ status: next })
      .eq("id", order.id);

    setUpdatingOrderId(null);

    if (error) {
      // Rollback
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, status: previousStatus } : o
        )
      );
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: `Pedido #${order.display_id} atualizado`,
      description: `Movido para "${columns.find((c) => c.key === next)?.label}"`,
    });
  };

  if (loading) {
    return <KitchenSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitor da Cozinha</h1>
          <p className="text-muted-foreground text-sm">Acompanhe os pedidos em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={soundEnabled ? "outline" : "ghost"}
            size="sm"
            onClick={toggleSound}
            title={soundEnabled ? "Som ativado" : "Som desativado"}
          >
            {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {columns.map((col) => (
          <div key={col.key}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`h-3 w-3 rounded-full ${col.color}`} />
              <h2 className="font-semibold">{col.label}</h2>
              <Badge variant="secondary" className="ml-auto text-xs">
                {orders.filter((o) => o.status === col.key).length}
              </Badge>
            </div>

            <div className="space-y-3">
              {orders
                .filter((o) => o.status === col.key)
                .map((order) => {
                  const isReady = col.key === "ready";
                  const timer = getTimerDisplay(order, isReady);
                  const isUpdating = updatingOrderId === order.id;

                  return (
                    <Card
                      key={order.id}
                      className="border-border/50 transition-all"
                      style={{ backgroundColor: timer.bgColor, color: timer.textColor }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-sm">#{order.display_id}</span>
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: timer.textColor, color: timer.textColor }}
                          >
                            {order.table_number ? `Mesa ${order.table_number}` : "S/ mesa"}
                          </Badge>
                        </div>
                        <ul className="space-y-1 mb-3">
                          {order.order_items.map((item) => (
                            <li key={item.id} className="text-sm" style={{ opacity: 0.8 }}>
                              • {item.quantity}x {item.product_name}
                              {item.notes ? ` (${item.notes})` : ""}
                            </li>
                          ))}
                        </ul>
                        <div className="flex items-center justify-between">
                          {col.key !== "ready" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              style={{ color: timer.textColor }}
                              onClick={() => advance(order)}
                              disabled={isUpdating}
                            >
                              {isUpdating ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : null}
                              {actionLabels[col.key]} <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                          <div
                            className="flex items-center gap-1 text-xs font-mono font-bold ml-auto"
                            style={{ color: timer.textColor }}
                          >
                            <Clock className="h-3 w-3" />
                            {timer.display}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              {orders.filter((o) => o.status === col.key).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum pedido</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KitchenMonitor;
