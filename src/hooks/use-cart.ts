import { useState, useCallback } from "react";
import type { PublicMenuItem } from "@/lib/restaurant-config";

export interface CartItem {
  item: PublicMenuItem;
  quantity: number;
  notes: string;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: PublicMenuItem, quantity: number, notes: string) => {
    setItems((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id
            ? { ...ci, quantity: ci.quantity + quantity, notes: notes || ci.notes }
            : ci
        );
      }
      return [...prev, { item, quantity, notes }];
    });
  }, []);

  const updateQuantity = useCallback((itemId: number, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((ci) => ci.item.id !== itemId)
        : prev.map((ci) => (ci.item.id === itemId ? { ...ci, quantity } : ci))
    );
  }, []);

  const removeItem = useCallback((itemId: number) => {
    setItems((prev) => prev.filter((ci) => ci.item.id !== itemId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, ci) => sum + ci.quantity, 0);
  const totalPrice = items.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0);

  return { items, addItem, updateQuantity, removeItem, clearCart, totalItems, totalPrice };
}
