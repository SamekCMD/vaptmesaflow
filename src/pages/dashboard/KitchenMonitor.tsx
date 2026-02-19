import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { KitchenSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const playBellSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(830, ctx.currentTime);
    osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(830, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
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

const KitchenMonitor = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());

  // Refresh elapsed times every 15s + auto-archive ready orders after 1 min
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);

      // Auto-archive ready orders older than 1 minute
      setOrders((prev) => {
        const now = Date.now();
        const toArchive = prev.filter(
          (o) => o.status === "ready" && o.updated_at &&
            (now - new Date(o.updated_at).getTime()) > 60000
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
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Get restaurant_id for the logged-in owner
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

      // Detect genuinely new orders (not seen before)
      if (knownOrderIdsRef.current.size > 0) {
        const newOrders = fetched.filter((o) => !knownOrderIdsRef.current.has(o.id));
        if (newOrders.length > 0) {
          playBellSound();
          toast({
            title: `🔔 ${newOrders.length} novo(s) pedido(s)!`,
            description: "Novos pedidos foram recebidos.",
          });
        }
      }

      // Update known IDs
      knownOrderIdsRef.current = new Set(fetched.map((o) => o.id));
      setOrders(fetched);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    if (restaurantId) fetchOrders();
  }, [restaurantId, fetchOrders]);

  // Polling every 5 seconds (replaces Realtime)
  useEffect(() => {
    if (!restaurantId) return;
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [restaurantId, fetchOrders]);

  const getElapsed = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return `${mins} min`;
  };

  const isOverdue = (dateStr: string) => {
    return (Date.now() - new Date(dateStr).getTime()) > 10 * 60000;
  };

  const advance = async (order: Order) => {
    const next = nextStatus[order.status];
    if (!next) return;

    const { error } = await supabase
      .from("orders")
      .update({ status: next })
      .eq("id", order.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? { ...o, status: next as Order["status"], updated_at: new Date().toISOString() }
          : o
      )
    );
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
        <Button variant="outline" size="sm" onClick={fetchOrders}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Atualizar
        </Button>
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
                .map((order) => (
                  <Card
                    key={order.id}
                    className={`border-border/50 transition-all ${
                      isOverdue(order.created_at) && col.key !== "ready"
                        ? "border-destructive border-2 animate-pulse"
                        : ""
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-sm">#{order.display_id}</span>
                        <Badge variant="outline" className="text-xs">
                          {order.table_number ? `Mesa ${order.table_number}` : "S/ mesa"}
                        </Badge>
                      </div>
                      <ul className="space-y-1 mb-3">
                        {order.order_items.map((item) => (
                          <li key={item.id} className="text-sm text-muted-foreground">
                            • {item.quantity}x {item.product_name}
                            {item.notes ? ` (${item.notes})` : ""}
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {getElapsed(order.created_at)}
                        </div>
                        {col.key !== "ready" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-primary" onClick={() => advance(order)}>
                            {actionLabels[col.key]} <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
