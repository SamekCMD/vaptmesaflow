import { describe, expect, it } from "vitest";
import { staleCatalogCartItems } from "@/lib/catalog/cart-review";
const item = { id: "item-1", price: 23.5, available: true, variations: [{ name: "Tamanho", options: ["Grande"], required: true }] };
describe("published catalog cart review", () => {
  it.each([
    { price: 30 }, { available: false }, { variations: [{ name: "Tamanho", options: ["Pequeno"], required: true }] },
  ])("requires review of changed price, options or availability: %j", change => {
    expect(staleCatalogCartItems([{ item }], [{ ...item, ...change }])).toEqual(["item-1"]);
  });
  it("keeps unaffected selections and accepts only explicitly re-added current items", () => {
    expect(staleCatalogCartItems([{ item }], [item])).toEqual([]);
    expect(staleCatalogCartItems([{ item }], [])).toEqual(["item-1"]);
    expect(staleCatalogCartItems([{ item: { ...item, price: 30 } }], [{ ...item, price: 30 }])).toEqual([]);
  });
});
