import { useState, useEffect } from "react";
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
import { Minus, Plus, X, ShoppingBag, AlertCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import type { PublicMenuItem, MenuItemVariation } from "@/lib/restaurant-config";

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
  const [added, setAdded] = useState(false);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [showError, setShowError] = useState(false);

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      onClose();
      setQuantity(1);
      setNotes("");
      setAdded(false);
      setSelectedVariations({});
      setShowError(false);
    }
  };

  useEffect(() => {
    if (item) {
      setSelectedVariations({});
      setShowError(false);
      setQuantity(1);
      setNotes("");
      setAdded(false);
    }
  }, [item?.id]);

  if (!item) return null;

  const variations: MenuItemVariation[] = item.variations || [];
  const requiredVariations = variations.filter(v => v.required);
  const missingRequired = requiredVariations.filter(v => !selectedVariations[v.name]);

  const handleAdd = () => {
    if (missingRequired.length > 0) {
      setShowError(true);
      return;
    }

    const variationNotes = Object.entries(selectedVariations)
      .map(([name, option]) => `${name}: ${option}`)
      .join(" | ");

    const finalNotes = [variationNotes, notes].filter(Boolean).join(" | ");

    onAdd(item, quantity, finalNotes);
    setAdded(true);
    setTimeout(() => {
      onClose();
      setQuantity(1);
      setNotes("");
      setAdded(false);
      setSelectedVariations({});
      setShowError(false);
    }, 600);
  };

  const selectVariation = (varName: string, option: string) => {
    setSelectedVariations(prev => ({ ...prev, [varName]: option }));
    setShowError(false);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-w-md mx-auto">
        {/* Hero image 16:9 */}
        {item.imageUrl ? (
          <div className="w-full aspect-video overflow-hidden rounded-t-xl">
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}

        <DrawerHeader className="relative">
          <DrawerClose asChild>
            <button className="absolute right-4 top-4 rounded-full p-1 bg-muted hover:bg-muted/80 transition-colors active:scale-90 z-10">
              <X className="h-4 w-4" />
            </button>
          </DrawerClose>

          <DrawerTitle className="text-lg">{item.name}</DrawerTitle>
          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
          <p className="text-lg font-bold mt-2" style={{ color: primaryColor }}>
            R$ {item.price.toFixed(2).replace(".", ",")}
          </p>

          {/* Prep time estimate */}
          {item.prepTimeMinutes && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Tempo estimado: ~{item.prepTimeMinutes} min
              </span>
            </div>
          )}
        </DrawerHeader>

        <div className="px-4 space-y-4">
          {/* Variations */}
          {variations.map((v) => (
            <div key={v.id || v.name}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm font-medium">{v.name}</span>
                {v.required && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                    Obrigatório
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {v.options.map((opt) => {
                  const isSelected = selectedVariations[v.name] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => selectVariation(v.name, opt)}
                      className="px-3 py-1.5 rounded-full text-sm border transition-all active:scale-95"
                      style={isSelected ? {
                        backgroundColor: primaryColor,
                        borderColor: primaryColor,
                        color: "#fff",
                      } : {
                        borderColor: "hsl(var(--border))",
                        color: "hsl(var(--foreground))",
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {showError && v.required && !selectedVariations[v.name] && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Selecione uma opção
                </p>
              )}
            </div>
          ))}

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

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Quantidade</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-8 w-8 rounded-full border border-border flex items-center justify-center transition-transform active:scale-90"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <motion.span
                key={quantity}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="text-lg font-semibold w-6 text-center"
              >
                {quantity}
              </motion.span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-white transition-transform active:scale-90"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <DrawerFooter>
          <Button
            className="w-full h-12 text-sm font-semibold transition-transform active:scale-[0.98]"
            style={{ backgroundColor: added ? "hsl(var(--primary))" : primaryColor }}
            onClick={handleAdd}
            disabled={added}
          >
            {added ? (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2"
              >
                <ShoppingBag className="h-4 w-4" />
                Adicionado!
              </motion.span>
            ) : (
              `Adicionar ao Carrinho — R$ ${(item.price * quantity).toFixed(2).replace(".", ",")}`
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default ProductDrawer;
