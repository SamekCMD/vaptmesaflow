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
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus, X } from "lucide-react";
import type { PublicMenuItem } from "@/lib/restaurant-config";

interface ProductDrawerProps {
  item: PublicMenuItem | null;
  open: boolean;
  onClose: () => void;
  onAdd: (item: PublicMenuItem, quantity: number, notes: string) => void;
  primaryColor: string;
}

const ProductDrawer = ({ item, open, onClose, onAdd, primaryColor }: ProductDrawerProps) => {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      onClose();
      setQuantity(1);
      setNotes("");
    }
  };

  if (!item) return null;

  const handleAdd = () => {
    onAdd(item, quantity, notes);
    onClose();
    setQuantity(1);
    setNotes("");
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-w-md mx-auto">
        <DrawerHeader className="relative">
          <DrawerClose asChild>
            <button className="absolute right-4 top-4 rounded-full p-1 bg-muted">
              <X className="h-4 w-4" />
            </button>
          </DrawerClose>

          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-48 object-cover rounded-lg mb-3"
            />
          )}

          <DrawerTitle className="text-lg">{item.name}</DrawerTitle>
          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
          <p className="text-lg font-bold mt-2" style={{ color: primaryColor }}>
            R$ {item.price.toFixed(2).replace(".", ",")}
          </p>
        </DrawerHeader>

        <div className="px-4 space-y-4">
          {/* Notes */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Observações</label>
            <Textarea
              placeholder="Ex: sem cebola, ponto da carne..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none h-20"
              maxLength={200}
            />
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Quantidade</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-8 w-8 rounded-full border border-border flex items-center justify-center"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="text-lg font-semibold w-6 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <DrawerFooter>
          <Button
            className="w-full h-12 text-sm font-semibold"
            style={{ backgroundColor: primaryColor }}
            onClick={handleAdd}
          >
            Adicionar ao Carrinho — R$ {(item.price * quantity).toFixed(2).replace(".", ",")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default ProductDrawer;
