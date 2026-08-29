import { useState, useEffect } from "react";
import { useCallback } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Clock, Package, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import InlineOrderRatingCard from "@/components/menu/InlineOrderRatingCard";
import { orderClient, readStoredOrderAccess, type PublicOrder } from "@/lib/order-client";

interface OrderData {
  id: string;
  display_id: number | null;
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

function mapPublicOrder(order: PublicOrder): OrderData {
  return {
    id: order.orderId,
    display_id: order.displayId,
    table_number: order.tableNumber,
    total_price: Number(order.totalPrice),
    status: order.status,
    created_at: order.createdAt,
    order_items: order.items.map((item) => ({
      product_name: item.name,
      quantity: item.quantity,
      unit_price: Number(item.unitPrice),
      notes: item.notes ?? "",
    })),
  };
}

const MyOrdersDrawer = ({ open, onClose, restaurantId, primaryColor }: MyOrdersDrawerProps) => {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const stored = readStoredOrderAccess(restaurantId);

    try {
      const loaded = await Promise.all(
        stored.map((access) =>
          orderClient.get(access.orderId, access.publicToken).catch(() => null),
        ),
      );
      setOrders(
        loaded
          .filter((order): order is PublicOrder => Boolean(order))
          .map(mapPublicOrder)
          .filter((order) => Date.now() - new Date(order.created_at).getTime() <= 24 * 60 * 60 * 1000)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      );
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (open) void fetchOrders();
  }, [fetchOrders, open]);

  useEffect(() => {
    if (!open) return;
    const interval = window.setInterval(() => void fetchOrders(), 8000);
    return () => window.clearInterval(interval);
  }, [fetchOrders, open]);

  const getElapsed = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return `${Math.max(0, mins)} min`;
  };

  const activeOrders = orders.filter((order) => order.status !== "delivered");
  const deliveredOrders = orders.filter((order) => order.status === "delivered");
  const deviceTotal = orders.reduce((sum, order) => sum + order.total_price, 0);

  const renderOrderCard = (order: OrderData, index: number) => {
    const status = statusConfig[order.status] || statusConfig.pending;
    return (
      <motion.div
        key={order.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="space-y-2 rounded-xl border border-border bg-card p-4"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">Pedido #{order.display_id ?? "-"}</span>
          <Badge className={`${status.color} text-xs text-white`}>{status.label}</Badge>
        </div>

        <ul className="space-y-0.5">
          {order.order_items.map((item, itemIndex) => (
            <li key={`${order.id}-${itemIndex}`} className="flex justify-between text-sm text-muted-foreground">
              <span>• {item.quantity}x {item.product_name}{item.notes ? ` (${item.notes})` : ""}</span>
              <span className="text-xs">R$ {(item.quantity * item.unit_price).toFixed(2).replace(".", ",")}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {getElapsed(order.created_at)}
          </div>
          <span className="font-semibold" style={{ color: primaryColor }}>
            R$ {order.total_price.toFixed(2).replace(".", ",")}
          </span>
        </div>

        {order.status === "delivered" && (
          <InlineOrderRatingCard
            orderId={order.id}
            restaurantId={restaurantId}
            displayId={order.display_id ?? 0}
            primaryColor={primaryColor}
          />
        )}
      </motion.div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DrawerContent className="mx-auto max-h-[85vh] max-w-md">
        <DrawerHeader className="relative">
          <DrawerClose asChild>
            <button aria-label="Fechar pedidos" className="absolute right-4 top-4 rounded-full bg-muted p-1 transition-colors hover:bg-muted/80 active:scale-90">
              <X className="h-4 w-4" />
            </button>
          </DrawerClose>
          <DrawerTitle>Meus Pedidos</DrawerTitle>
        </DrawerHeader>

        {orders.length > 0 && (
          <div className="mx-4 mb-3 rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Pedidos deste dispositivo</span>
              <span className="text-lg font-bold" style={{ color: primaryColor }}>
                R$ {deviceTotal.toFixed(2).replace(".", ",")}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} nas últimas 24 horas
            </p>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">
          {loading && <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>}

          {!loading && orders.length === 0 && (
            <div className="space-y-2 py-12 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum pedido realizado ainda.</p>
            </div>
          )}

          {activeOrders.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Em andamento ({activeOrders.length})
              </p>
              <AnimatePresence>
                {activeOrders.map((order, index) => renderOrderCard(order, index))}
              </AnimatePresence>
            </>
          )}

          {deliveredOrders.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Entregues ({deliveredOrders.length})
              </p>
              <AnimatePresence>
                {deliveredOrders.map((order, index) => renderOrderCard(order, index))}
              </AnimatePresence>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MyOrdersDrawer;
