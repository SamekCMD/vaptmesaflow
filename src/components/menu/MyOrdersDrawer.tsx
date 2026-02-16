import { useState, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { X, Clock, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface OrderData {
  id: string;
  display_id: number;
  table_number: string | null;
  total_price: number;
  status: string;
  created_at: string;
  order_items: { product_name: string; quantity: number; unit_price: number; notes: string }[];
}

interface MyOrdersDrawerProps {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  primaryColor: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  waiting_payment: { label: "Aguardando Pgto", color: "bg-orange-500" },
  pending: { label: "Na fila", color: "bg-yellow-500" },
  preparing: { label: "Preparando", color: "bg-blue-500" },
  ready: { label: "Pronto!", color: "bg-green-500" },
  delivered: { label: "Entregue", color: "bg-gray-400" },
};

const MyOrdersDrawer = ({ open, onClose, restaurantId, primaryColor }: MyOrdersDrawerProps) => {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(false);

  const getStoredOrderIds = (): string[] => {
    try {
      const stored = localStorage.getItem(`orders_${restaurantId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const fetchOrders = async () => {
    const ids = getStoredOrderIds();
    if (ids.length === 0) return;

    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .in("id", ids)
      .order("created_at", { ascending: false });

    if (data) setOrders(data as unknown as OrderData[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchOrders();
  }, [open]);

  // Realtime subscription
  useEffect(() => {
    const ids = getStoredOrderIds();
    if (ids.length === 0) return;

    const channel = supabase
      .channel("my-orders-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new as any;
          if (!ids.includes(updated.id)) return;

          setOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status } : o))
          );

          if (updated.status === "ready") {
            toast({
              title: "🎉 Pedido pronto!",
              description: `Seu pedido #${updated.display_id} está pronto para retirada!`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const getElapsed = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return `${mins} min`;
  };

  // Calculate total for "Minha Comanda"
  const comandaTotal = orders
    .filter((o) => !["delivered", "waiting_payment"].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total_price), 0);

  const activeOrders = orders.filter((o) => !["delivered"].includes(o.status));

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-w-md mx-auto max-h-[85vh]">
        <DrawerHeader className="relative">
          <DrawerClose asChild>
            <button className="absolute right-4 top-4 rounded-full p-1 bg-muted hover:bg-muted/80 transition-colors active:scale-90">
              <X className="h-4 w-4" />
            </button>
          </DrawerClose>
          <DrawerTitle>Meus Pedidos</DrawerTitle>
        </DrawerHeader>

        {/* Comanda Total */}
        {activeOrders.length > 0 && (
          <div className="mx-4 mb-3 p-3 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Minha Comanda</span>
              <span className="text-lg font-bold" style={{ color: primaryColor }}>
                R$ {comandaTotal.toFixed(2).replace(".", ",")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeOrders.length} {activeOrders.length === 1 ? "pedido" : "pedidos"} nesta mesa
            </p>
          </div>
        )}

        <div className="px-4 pb-6 overflow-y-auto flex-1 space-y-3">
          {loading && (
            <p className="text-center text-muted-foreground text-sm py-8">Carregando...</p>
          )}

          {!loading && orders.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <Package className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground text-sm">Nenhum pedido realizado ainda.</p>
            </div>
          )}

          <AnimatePresence>
            {orders.map((order, i) => {
              const sc = statusConfig[order.status] || statusConfig.pending;
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-xl bg-card border border-border space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Pedido #{order.display_id}</span>
                    <Badge className={`${sc.color} text-white text-xs`}>{sc.label}</Badge>
                  </div>

                  <ul className="space-y-0.5">
                    {order.order_items.map((item, j) => (
                      <li key={j} className="text-sm text-muted-foreground">
                        • {item.quantity}x {item.product_name}
                        {item.notes ? ` (${item.notes})` : ""}
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getElapsed(order.created_at)}
                    </div>
                    <span className="font-semibold" style={{ color: primaryColor }}>
                      R$ {Number(order.total_price).toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MyOrdersDrawer;
