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
import { supabase } from "@/lib/supabase";
import InlineOrderRatingCard from "@/components/menu/InlineOrderRatingCard";

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
  tableSessionId?: string | null;
  paymentMode?: "open_tab" | "prepaid";
}

const statusConfig: Record<string, { label: string; color: string }> = {
  waiting_payment: { label: "Aguardando Pgto", color: "bg-orange-500" },
  paid: { label: "Pago", color: "bg-emerald-500" },
  pending: { label: "Na fila", color: "bg-yellow-500" },
  preparing: { label: "Preparando", color: "bg-blue-500" },
  ready: { label: "Pronto!", color: "bg-green-500" },
  delivered: { label: "Entregue", color: "bg-gray-400" },
};

const MyOrdersDrawer = ({ open, onClose, restaurantId, primaryColor, tableSessionId, paymentMode }: MyOrdersDrawerProps) => {
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
    setLoading(true);

    if (paymentMode === "open_tab" && tableSessionId) {
      // Fetch ALL orders from this session (including delivered)
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("table_session_id", tableSessionId)
        .order("created_at", { ascending: false });

      if (data) setOrders(data as unknown as OrderData[]);
    } else {
      const ids = getStoredOrderIds();
      if (ids.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .in("id", ids)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false });

      if (data) setOrders(data as unknown as OrderData[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const getElapsed = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return `${mins} min`;
  };

  // Separate active vs delivered orders
  const activeOrders = orders.filter((o) => !["delivered"].includes(o.status));
  const deliveredOrders = orders.filter((o) => o.status === "delivered");

  // Session total (all orders)
  const sessionTotal = orders.reduce((sum, o) => sum + Number(o.total_price), 0);

  // Active comanda total
  const comandaTotal = activeOrders.reduce((sum, o) => sum + Number(o.total_price), 0);

  const renderOrderCard = (order: OrderData, i: number) => {
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
            <li key={j} className="text-sm text-muted-foreground flex justify-between">
              <span>• {item.quantity}x {item.product_name}{item.notes ? ` (${item.notes})` : ""}</span>
              <span className="text-xs">R$ {(item.quantity * Number(item.unit_price)).toFixed(2).replace(".", ",")}</span>
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

        {/* Só pedidos entregues entram no fluxo de avaliação. */}
        {order.status === "delivered" && (
          <InlineOrderRatingCard
            orderId={order.id}
            restaurantId={restaurantId}
            displayId={order.display_id}
            primaryColor={primaryColor}
          />
        )}
      </motion.div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-w-md mx-auto max-h-[85vh]">
        <DrawerHeader className="relative">
          <DrawerClose asChild>
            <button aria-label="Fechar pedidos" className="absolute right-4 top-4 rounded-full p-1 bg-muted hover:bg-muted/80 transition-colors active:scale-90">
              <X className="h-4 w-4" />
            </button>
          </DrawerClose>
          <DrawerTitle>Meus Pedidos</DrawerTitle>
        </DrawerHeader>

        {/* Comanda Total */}
        {orders.length > 0 && (
          <div className="mx-4 mb-3 p-3 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Minha Comanda</span>
              <span className="text-lg font-bold" style={{ color: primaryColor }}>
                R$ {sessionTotal.toFixed(2).replace(".", ",")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} nesta sessão
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

          {/* Active orders */}
          {activeOrders.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Em andamento ({activeOrders.length})
              </p>
              <AnimatePresence>
                {activeOrders.map((order, i) => renderOrderCard(order, i))}
              </AnimatePresence>
            </>
          )}

          {/* Delivered orders */}
          {deliveredOrders.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">
                Entregues ({deliveredOrders.length})
              </p>
              <AnimatePresence>
                {deliveredOrders.map((order, i) => renderOrderCard(order, i))}
              </AnimatePresence>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MyOrdersDrawer;

