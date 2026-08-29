import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, X, CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import type { CartItem } from "@/hooks/use-cart";
import {
  createOrderIdempotencyKey,
  orderClient,
  readStoredOrderAccess,
  type StoredOrderAccess,
} from "@/lib/order-client";
import { paymentClient, savePendingCheckout } from "@/lib/payment-client";
import { parseHostedCheckoutUrl } from "@/lib/hosted-checkout-url";
import { VaptApiClientError } from "@/lib/vapt-api-client";

interface OrderSummaryDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  totalPrice: number;
  onUpdateQuantity: (id: number, qty: number) => void;
  onRemove: (id: number) => void;
  onClearCart: () => void;
  primaryColor: string;
  restaurantId?: string;
  restaurantSlug?: string;
  tableNumber?: string;
  onOrderPlaced?: (access: StoredOrderAccess) => void;
  onSessionCreated?: (sessionId: string) => void;
  paymentMode?: "open_tab" | "prepaid";
  maxPendingOrders?: number;
  tableSessionId?: string | null;
}

const OrderSummaryDrawer = ({
  open,
  onClose,
  items,
  totalPrice,
  onUpdateQuantity,
  onRemove,
  onClearCart,
  primaryColor,
  restaurantId,
  tableNumber,
  restaurantSlug,
  onOrderPlaced,
  onSessionCreated,
  paymentMode = "open_tab",
  maxPendingOrders = 3,
}: OrderSummaryDrawerProps) => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const idempotencyKeyRef = useRef<string | null>(null);

  const checkPendingOrdersLimit = async (): Promise<boolean> => {
    if (paymentMode !== "open_tab" || !restaurantId) return true;

    try {
      const stored = readStoredOrderAccess(restaurantId);
      const orders = await Promise.all(
        stored.map((access) =>
          orderClient.get(access.orderId, access.publicToken).catch(() => null),
        ),
      );
      const pendingCount = orders.filter(
        (order) => order && ["pending", "preparing"].includes(order.status),
      ).length;

      if (pendingCount >= maxPendingOrders) {
        toast({
          title: "Limite de pedidos atingido",
          description: `Aguarde seus pedidos anteriores serem aceitos pela cozinha. Máximo: ${maxPendingOrders} pedidos pendentes.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  const handleSendOrder = async () => {
    if (!restaurantId || !restaurantSlug) {
      toast({ title: "Erro", description: "Restaurante não identificado.", variant: "destructive" });
      return;
    }

    const canProceed = await checkPendingOrdersLimit();
    if (!canProceed) return;

    setSending(true);

    try {
      idempotencyKeyRef.current ??= createOrderIdempotencyKey();
      const order = await orderClient.create(
        {
          restaurantSlug,
          channel: "local",
          ...(tableNumber && Number.isInteger(Number(tableNumber))
            ? { tableNumber: Number(tableNumber) }
            : {}),
          items: items.map((cartItem) => ({
            menuItemId: String(cartItem.item.id),
            quantity: cartItem.quantity,
            notes: cartItem.notes || undefined,
          })),
        },
        idempotencyKeyRef.current,
      );

      onOrderPlaced?.({ orderId: order.orderId, publicToken: order.publicToken });
      if (order.tableSessionId) onSessionCreated?.(order.tableSessionId);

      if (paymentMode === "prepaid") {
        const checkout = await paymentClient.startHosted(
          order.orderId,
          order.publicToken,
          `checkout-${idempotencyKeyRef.current}`,
        );
        const checkoutUrl = parseHostedCheckoutUrl(checkout.checkoutUrl);

        savePendingCheckout({
          orderId: order.orderId,
          publicToken: order.publicToken,
          transactionId: checkout.transactionId,
          returnPath: `${window.location.pathname}${window.location.search}`,
          checkoutUrl: checkoutUrl.toString(),
          expiresAt: checkout.expiresAt,
        });
        idempotencyKeyRef.current = null;
        window.location.assign(checkoutUrl.toString());
      } else {
        idempotencyKeyRef.current = null;
        setSending(false);
        setSent(true);

        toast({
          title: `Pedido #${order.displayId} enviado!`,
          description: "Acompanhe o status em 'Meus Pedidos'.",
        });

        setTimeout(() => {
          setSent(false);
          onClearCart();
          onClose();
        }, 2500);
      }
    } catch (err: unknown) {
      setSending(false);
      const description =
        err instanceof VaptApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Tente novamente.";
      toast({
        title: "Erro ao enviar pedido",
        description,
        variant: "destructive",
      });
    }
  };

  const handleOpenChange = (o: boolean) => {
    if (!o && !sending) {
      setSent(false);
      onClose();
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="max-w-md mx-auto max-h-[85vh]">
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center justify-center py-16 px-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.22, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                >
                  <CheckCircle2 className="h-16 w-16 mb-4" style={{ color: primaryColor }} />
                </motion.div>
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-xl font-bold mb-2"
                >
                  {paymentMode === "prepaid" ? "Pagamento Confirmado!" : "Pedido Enviado!"}
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-muted-foreground text-sm text-center"
                >
                  {paymentMode === "prepaid"
                    ? "Seu pedido foi enviado para a cozinha."
                    : "Acompanhe o status na aba \"Meus Pedidos\"."}
                </motion.p>
              </motion.div>
            ) : (
              <motion.div key="cart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <DrawerHeader className="relative">
                  <DrawerClose asChild>
                    <button aria-label="Fechar resumo do pedido" className="absolute right-4 top-4 rounded-full p-1 bg-muted hover:bg-muted/80 transition-colors active:scale-90">
                      <X className="h-4 w-4" />
                    </button>
                  </DrawerClose>
                  <DrawerTitle>Seu Pedido</DrawerTitle>
                  {tableNumber && (
                    <p className="text-sm text-muted-foreground">Mesa {tableNumber}</p>
                  )}
                </DrawerHeader>

                <div className="px-4 overflow-y-auto flex-1 space-y-3">
                  {items.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-8">
                      Seu carrinho está vazio.
                    </p>
                  )}

                  <AnimatePresence>
                    {items.map((ci) => (
                      <motion.div
                        key={ci.item.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold truncate">{ci.item.name}</h4>
                          {ci.notes && (
                            <p className="text-xs text-muted-foreground truncate">Obs: {ci.notes}</p>
                          )}
                          <p className="text-sm font-bold mt-1" style={{ color: primaryColor }}>
                            R$ {(ci.item.price * ci.quantity).toFixed(2).replace(".", ",")}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onUpdateQuantity(ci.item.id, ci.quantity - 1)}
                            className="h-7 w-7 rounded-full border border-border flex items-center justify-center transition-transform active:scale-90"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <motion.span
                            key={ci.quantity}
                            initial={{ scale: 1.3 }}
                            animate={{ scale: 1 }}
                            className="text-sm font-semibold w-5 text-center"
                          >
                            {ci.quantity}
                          </motion.span>
                          <button
                            onClick={() => onUpdateQuantity(ci.item.id, ci.quantity + 1)}
                            className="h-7 w-7 rounded-full flex items-center justify-center text-white transition-transform active:scale-90"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => onRemove(ci.item.id)}
                            className="h-7 w-7 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-all active:scale-90"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <DrawerFooter>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Total</span>
                    <motion.span
                      key={totalPrice}
                      initial={{ scale: 1.1 }}
                      animate={{ scale: 1 }}
                      className="text-lg font-bold"
                      style={{ color: primaryColor }}
                    >
                      R$ {totalPrice.toFixed(2).replace(".", ",")}
                    </motion.span>
                  </div>
                  <Button
                    className="w-full h-12 text-sm font-semibold transition-transform active:scale-[0.98]"
                    style={{ backgroundColor: primaryColor }}
                    disabled={items.length === 0 || sending}
                    onClick={handleSendOrder}
                  >
                    {sending ? (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {paymentMode === "prepaid" ? "Abrindo pagamento..." : "Enviando..."}
                      </motion.span>
                    ) : paymentMode === "prepaid" ? (
                      "Pagar online"
                    ) : (
                      "Enviar para a cozinha"
                    )}
                  </Button>
                </DrawerFooter>
              </motion.div>
            )}
          </AnimatePresence>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default OrderSummaryDrawer;

