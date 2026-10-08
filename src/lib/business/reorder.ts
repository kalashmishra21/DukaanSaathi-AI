import type { Product } from "./schemas";

/** A draft quantity targets twice the threshold, with at least one unit. */
export function reorderSuggestions(products: Pick<Product, "id" | "name" | "current_stock" | "low_stock_threshold" | "cost_price" | "selling_price">[]) {
  return products.filter((product) => product.current_stock <= product.low_stock_threshold)
    .map((product) => ({
      productId: product.id,
      name: product.name,
      stock: product.current_stock,
      threshold: product.low_stock_threshold,
      quantity: Math.max(1, product.low_stock_threshold * 2 - product.current_stock),
      unitCost: product.cost_price ?? product.selling_price,
    }));
}
