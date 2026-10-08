import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/lib/ai/providers/mock";

describe("merchant workflow reasoning", () => {
  it.each([
    ["Suppliers dikhao", "supplier.list", {}],
    ["New supplier Demo Wholesale add karo", "supplier.create", { name: "Demo Wholesale" }],
    ["Open orders dikhao", "orders.getOpen", {}],
    ["Low-stock items ki reorder list bana do", "inventory.getReorderSuggestions", {}],
    ["North Market Distributors se Maggi ke 10 packet ka purchase order draft banao", "orders.createDraft", { supplier: "North Market Distributors", items: [{ product: "Maggi", quantity: 10 }] }],
  ])("validates %s without network access", async (text, intent, args) => {
    expect(await new MockAIProvider().reason({ text: String(text) })).toEqual({ kind: "tool_call", tool: { intent, arguments: args } });
  });
});
