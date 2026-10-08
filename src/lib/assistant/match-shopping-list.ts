import { shoppingDraftSchema, shoppingExtractionSchema, type ShoppingDraft } from "./shopping-list";

export type CatalogProduct = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  sellingPrice: number;
};

function normalize(value: string): string {
  return value.toLocaleLowerCase("en-IN").normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

export function matchShoppingList(rawItems: unknown, catalog: CatalogProduct[]): ShoppingDraft {
  const { items } = shoppingExtractionSchema.parse({ items: rawItems });
  const seen = new Set<string>();
  const draftItems = items.map((item) => {
    const key = normalize(item.product);
    if (seen.has(key)) throw new Error("The list repeats a product. Combine its quantities and try again.");
    seen.add(key);
    const matches = catalog.filter((product) => normalize(product.name) === key);
    const product = matches.length === 1 ? matches[0] : undefined;
    if (!product) return { requestedName: item.product, quantity: item.quantity, status: "missing" as const };
    const lineTotal = Math.round(product.sellingPrice * 100) * item.quantity / 100;
    return {
      requestedName: item.product,
      quantity: item.quantity,
      status: product.currentStock >= item.quantity ? "available" as const : "short" as const,
      productId: product.id,
      productName: product.name,
      stock: product.currentStock,
      unit: product.unit,
      unitPrice: product.sellingPrice,
      lineTotal,
    };
  });
  return shoppingDraftSchema.parse({
    items: draftItems,
    estimatedTotal: draftItems.reduce((sum, item) => sum + ("lineTotal" in item ? (item.lineTotal ?? 0) : 0), 0),
    canConfirm: draftItems.every((item) => item.status === "available"),
  });
}
