import { isCatalogWithinHours } from "./availability";

type Item = {
  id: string | number; price: number; available: boolean;
  availableFrom?: string | null; availableUntil?: string | null;
  variations?: readonly { name: string; options: readonly string[]; required?: boolean }[];
};
export const catalogCartReviewMessage = "Revise o carrinho: preço, opções ou disponibilidade mudaram. Remova e adicione novamente os itens alterados antes de confirmar.";
const choices = (item: Item) => JSON.stringify((item.variations ?? []).map(value => [value.name, value.options, value.required ?? false]));

// Keep the customer's original selection/price visible, but never submit it as
// if it were still current. Removing and re-adding is explicit reconfirmation.
export function staleCatalogCartItems(cart: readonly { item: Item }[], catalog: readonly Item[]): Array<string | number> {
  const current = new Map(catalog.map(item => [item.id, item]));
  return cart.filter(({ item }) => {
    const fresh = current.get(item.id);
    return !fresh || !fresh.available || !isCatalogWithinHours(fresh.availableFrom, fresh.availableUntil)
      || !Number.isFinite(fresh.price) || item.price !== fresh.price || choices(item) !== choices(fresh);
  }).map(({ item }) => item.id);
}
