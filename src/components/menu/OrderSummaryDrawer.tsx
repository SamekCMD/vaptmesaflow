import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, X } from "lucide-react";
import type { CartItem } from "@/hooks/use-cart";

interface OrderSummaryDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  totalPrice: number;
  onUpdateQuantity: (id: number, qty: number) => void;
  onRemove: (id: number) => void;
  primaryColor: string;
}

const OrderSummaryDrawer = ({
  open,
  onClose,
  items,
  totalPrice,
  onUpdateQuantity,
  onRemove,
  primaryColor,
}: OrderSummaryDrawerProps) => {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-w-md mx-auto max-h-[85vh]">
        <DrawerHeader className="relative">
          <DrawerClose asChild>
            <button className="absolute right-4 top-4 rounded-full p-1 bg-muted">
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

          {items.map((ci) => (
            <div key={ci.item.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
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
                  className="h-7 w-7 rounded-full border border-border flex items-center justify-center"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="text-sm font-semibold w-5 text-center">{ci.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(ci.item.id, ci.quantity + 1)}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onRemove(ci.item.id)}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <DrawerFooter>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Total</span>
            <span className="text-lg font-bold" style={{ color: primaryColor }}>
              R$ {totalPrice.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <Button
            className="w-full h-12 text-sm font-semibold"
            style={{ backgroundColor: primaryColor }}
            disabled={items.length === 0}
            onClick={() => {
              // TODO: Send order to backend / WhatsApp
              alert("Pedido enviado! (placeholder)");
            }}
          >
            Enviar Pedido
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default OrderSummaryDrawer;
