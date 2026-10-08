import { describe, expect, it } from "vitest";
import { parseTextShoppingList } from "../src/lib/assistant/parse-text-list";
import { matchShoppingList } from "../src/lib/assistant/match-shopping-list";
import { OpenRouterVisionExtractor } from "../src/lib/ai/vision/openrouter-vision";

const catalog = [
  { id: "11111111-1111-4111-8111-111111111112", name: "Maggi", unit: "packet", currentStock: 10, sellingPrice: 15 },
  { id: "11111111-1111-4111-8111-111111111113", name: "Parle-G", unit: "packet", currentStock: 1, sellingPrice: 10 },
];

describe("shopping-list extraction and draft boundary", () => {
  it("extracts lines from a text PDF without remote OCR", () => {
    expect(parseTextShoppingList("Shopping list\nMaggi - 2 packets\nParle-G: ३ packs")).toEqual([
      { product: "Maggi", quantity: 2 }, { product: "Parle-G", quantity: 3 },
    ]);
  });

  it("prices matched lines and flags short and missing stock", () => {
    const draft = matchShoppingList([
      { product: "Maggi", quantity: 2 }, { product: "Parle-G", quantity: 3 }, { product: "Unknown", quantity: 1 },
    ], catalog);
    expect(draft).toMatchObject({ canConfirm: false, estimatedTotal: 60,
      items: [{ status: "available", unitPrice: 15, lineTotal: 30 }, { status: "short", stock: 1, lineTotal: 30 }, { status: "missing" }] });
  });

  it("validates vision JSON and detects provider errors inside HTTP 200", async () => {
    const image = [{ mimeType: "image/png" as const, bytes: new Uint8Array([137, 80, 78, 71]) }];
    const valid: typeof fetch = async () => Response.json({ choices: [{ message: { content: '{"items":[{"product":"Maggi","quantity":2}]}' } }] });
    await expect(new OpenRouterVisionExtractor("test-key", "test:free", valid).extract(image)).resolves.toEqual([{ product: "Maggi", quantity: 2 }]);
    const embeddedError: typeof fetch = async () => Response.json({ error: { code: 502, message: "Upstream unavailable" } });
    await expect(new OpenRouterVisionExtractor("test-key", "test:free", embeddedError).extract(image)).rejects.toThrow("temporarily unavailable");
    const invalid: typeof fetch = async () => Response.json({ choices: [{ message: { content: '{"items":[{"product":"Maggi","quantity":"2"}]}' } }] });
    await expect(new OpenRouterVisionExtractor("test-key", "test:free", invalid).extract(image)).rejects.toThrow();
  });
});
