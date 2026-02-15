import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { KitchenSkeleton } from "@/components/skeletons/DashboardSkeletons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  status: "pending" | "preparing" | "ready";
  created_at: string;
  updated_at: string | null;
  order_items: OrderItem[];
}

const columns = [
  { key: "pending" as const, label: "Novos", color: "bg-yellow-500" },
  { key: "preparing" as const, label: "Preparando", color: "bg-blue-500" },
  { key: "ready" as const, label: "Prontos", color: "bg-green-500" },
];

const nextStatus: Record<string, string> = {
  pending: "preparing",
  preparing: "ready",
};

const actionLabels: Record<string, string> = {
  pending: "Aceitar",
  preparing: "Finalizar",
};

const KitchenMonitor = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

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

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("restaurant_id", restaurantId)
      .in("status", ["pending", "preparing", "ready"])
      .order("created_at", { ascending: true });

    if (data) setOrders(data as unknown as Order[]);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    if (restaurantId) fetchOrders();
  }, [restaurantId, fetchOrders]);

  // Realtime subscription
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel("kds-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          fetchOrders();
          toast({ title: "🔔 Novo pedido!", description: "Um novo pedido foi recebido." });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const updated = payload.new as any;
          setOrders((prev) =>
            prev
              .map((o) => (o.id === updated.id ? { ...o, status: updated.status, updated_at: updated.updated_at } : o))
              .filter((o) => ["pending", "preparing", "ready"].includes(o.status))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      <div className="grid md:grid-cols-3 gap-6">
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
