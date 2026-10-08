import { shoppingExtractionSchema, type ShoppingItem } from "./shopping-list";

export function parseTextShoppingList(text: string): ShoppingItem[] {
  const items: ShoppingItem[] = [];
  for (const rawLine of text.replace(/[०-९]/gu, (digit) => String("०१२३४५६७८९".indexOf(digit))).split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[•*\-\d.)\s]+(?=\S)/u, "");
    const match = /^(.+?)\s*(?:[-:×x]\s*|\s+)(\d{1,5})(?:\s*(?:packets?|packs?|pieces?|pcs?|पैकेट))?\s*$/iu.exec(line);
    if (!match) continue;
    items.push({ product: match[1].trim(), quantity: Number(match[2]) });
  }
  return shoppingExtractionSchema.parse({ items }).items;
}
