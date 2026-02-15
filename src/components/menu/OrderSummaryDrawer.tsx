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
import type { CartItem } from "@/hooks/use-cart";

interface OrderSummaryDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  totalPrice: number;
  onUpdateQuantity: (id: number, qty: number) => void;
  onRemove: (id: number) => void;
  onClearCart: () => void;
  primaryColor: string;
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
}: OrderSummaryDrawerProps) => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendOrder = async () => {
    setSending(true);
    // Simulate sending order (replace with real API later)
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    setSent(true);
    // Auto-close after showing success
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
                Pedido Enviado!
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-muted-foreground text-sm text-center"
              >
                Seu pedido foi recebido com sucesso. Aguarde a preparação!
              </motion.p>
            </motion.div>
          ) : (
            <motion.div
              key="cart"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DrawerHeader className="relative">
                <DrawerClose asChild>
                  <button className="absolute right-4 top-4 rounded-full p-1 bg-muted hover:bg-muted/80 transition-colors active:scale-90">
                    <X className="h-4 w-4" />
                  </button>
                </DrawerClose>
                <DrawerTitle>Seu Pedido</DrawerTitle>
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
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </motion.span>
                  ) : (
                    "Enviar Pedido"
                  )}
                </Button>
              </DrawerFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DrawerContent>
    </Drawer>
  );
};

export default OrderSummaryDrawer;
