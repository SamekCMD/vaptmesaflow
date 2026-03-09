import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, X, CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { CartItem } from "@/hooks/use-cart";
import PixPaymentModal from "@/components/menu/PixPaymentModal";
import { supabase } from "@/integrations/supabase/client";

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
  tableNumber?: string;
  onOrderPlaced?: (orderId: string) => void;
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
  onOrderPlaced,
  onSessionCreated,
  paymentMode = "open_tab",
  maxPendingOrders = 3,
  tableSessionId,
}: OrderSummaryDrawerProps) => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Pix payment state
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{
    orderId: string;
    qrCodeBase64: string;
    pixPayload: string;
    expiration: string;
  } | null>(null);

  const checkPendingOrdersLimit = async (): Promise<boolean> => {
    if (paymentMode !== "open_tab" || !restaurantId) return true;

    try {
      const key = `orders_${restaurantId}`;
      const stored = JSON.parse(localStorage.getItem(key) || "[]");
      if (stored.length === 0) return true;

      const { data } = await supabase
        .from("orders")
        .select("id, status")
        .in("id", stored)
        .in("status", ["pending", "preparing"]);

      if (data && data.length >= maxPendingOrders) {
        toast({
          title: "Limite de pedidos atingido",
          description: `Aguarde seus pedidos anteriores serem aceitos pela cozinha. Máximo: ${maxPendingOrders} pedidos pendentes.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    } catch {
      return true; // allow on error
    }
  };

  const handleSendOrder = async () => {
    if (!restaurantId) {
      toast({ title: "Erro", description: "Restaurante não identificado.", variant: "destructive" });
      return;
    }

    // Anti-fraud: check pending orders limit
    const canProceed = await checkPendingOrdersLimit();
    if (!canProceed) return;

    setSending(true);

    try {
      const orderStatus = paymentMode === "prepaid" ? "waiting_payment" : "pending";

      // For open_tab: create session BEFORE order if none exists
      let effectiveSessionId = tableSessionId;
      if (paymentMode === "open_tab" && tableNumber && !effectiveSessionId) {
        try {
          const { data: newSession } = await supabase
            .from("table_sessions")
            .insert({
              restaurant_id: restaurantId,
              table_number: tableNumber,
              status: "open",
            })
            .select("id")
            .single();

          if (newSession) {
            effectiveSessionId = newSession.id;
            onSessionCreated?.(newSession.id);
          }
        } catch {
          // Session might already exist, try to find it
          const { data: existing } = await supabase
            .from("table_sessions")
            .select("id")
            .eq("restaurant_id", restaurantId!)
            .eq("table_number", tableNumber)
            .in("status", ["open", "check_requested"])
            .single();

          if (existing) {
            effectiveSessionId = existing.id;
            onSessionCreated?.(existing.id);
          }
        }
      }

      // Insert order with session already linked
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurantId,
          table_number: tableNumber || null,
          total_price: totalPrice,
          status: orderStatus,
          ...(effectiveSessionId ? { table_session_id: effectiveSessionId } : {}),
        } as any)
        .select("id, display_id")
        .single();

      if (orderError || !orderData) throw orderError;

      // Insert order items
      const orderItems = items.map((ci) => ({
        order_id: orderData.id,
        product_id: String(ci.item.id),
        product_name: ci.item.name,
        quantity: ci.quantity,
        unit_price: ci.item.price,
        notes: ci.notes || "",
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      // Save order ID to localStorage
      onOrderPlaced?.(orderData.id);

      if (paymentMode === "prepaid") {
        // Call n8n webhook to create Pix payment
        const res = await fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurant_id: restaurantId,
            order_id: orderData.id,
            value: totalPrice,
            customer_name: `Mesa ${tableNumber || "S/N"}`,
            table_number: tableNumber,
          }),
        });

        if (!res.ok) {
          throw new Error("Erro ao gerar pagamento Pix");
        }

        const pixResult = await res.json();

        if (!pixResult?.payment_id) {
          throw new Error("Resposta inválida do servidor de pagamento");
        }

        setPixData({
          orderId: orderData.id,
          qrCodeBase64: pixResult.qr_code_base64,
          pixPayload: pixResult.pix_payload,
          expiration: pixResult.expiration,
        });
        setSending(false);
        setPixModalOpen(true);
      } else {
        // Open tab: order sent directly
        setSending(false);
        setSent(true);

        toast({
          title: `Pedido #${orderData.display_id} enviado!`,
          description: "Acompanhe o status em 'Meus Pedidos'.",
        });

        setTimeout(() => {
          setSent(false);
          onClearCart();
          onClose();
        }, 2500);
      }
    } catch (err: any) {
      setSending(false);
      toast({
        title: "Erro ao enviar pedido",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handlePixConfirmed = () => {
    setPixModalOpen(false);
    setPixData(null);
    setSent(true);

    toast({
      title: "Pagamento confirmado! 🎉",
      description: "Seu pedido foi enviado para a cozinha!",
    });

    setTimeout(() => {
      setSent(false);
      onClearCart();
      onClose();
    }, 2500);
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
                transition={{ type: "spring", duration: 0.5 }}
                className="flex flex-col items-center justify-center py-16 px-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1, stiffness: 200 }}
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
                    ? "Seu pedido foi enviado para a cozinha! 🎉"
                    : "Acompanhe o status na aba \"Meus Pedidos\"."}
                </motion.p>
              </motion.div>
            ) : (
              <motion.div key="cart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <DrawerHeader className="relative">
                  <DrawerClose asChild>
                    <button className="absolute right-4 top-4 rounded-full p-1 bg-muted hover:bg-muted/80 transition-colors active:scale-90">
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
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
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
                        {paymentMode === "prepaid" ? "Gerando Pix..." : "Enviando..."}
                      </motion.span>
                    ) : paymentMode === "prepaid" ? (
                      "Pagar com Pix"
                    ) : (
                      "Confirmar Pedido"
                    )}
                  </Button>
                </DrawerFooter>
              </motion.div>
            )}
          </AnimatePresence>
        </DrawerContent>
      </Drawer>

      {/* Pix Payment Modal */}
      {pixData && (
        <PixPaymentModal
          open={pixModalOpen}
          onClose={() => {
            setPixModalOpen(false);
            setPixData(null);
          }}
          orderId={pixData.orderId}
          qrCodeBase64={pixData.qrCodeBase64}
          pixPayload={pixData.pixPayload}
          expiration={pixData.expiration}
          primaryColor={primaryColor}
          onPaymentConfirmed={handlePixConfirmed}
        />
      )}
    </>
  );
};

export default OrderSummaryDrawer;
