import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/lib/ai/providers/mock";
import { toolCallSchema } from "../src/lib/ai/types/tool-call";

const products = ["Maggi", "Amul Milk", "Parle G", "Bread", "Ice Cream", "Tata Salt", "Rice", "Tea", "Sugar", "Biscuits"];
const customers = ["Mahi", "Nandini", "Sharma ji", "Sanket", "Rahul", "Priya", "Amit", "Rekha", "Imran", "Sunita"];
const examples: Array<{ text: string; intent: string; kind?: never; pending?: never } | { text: string; kind: "clarify"; pending: string; intent?: never }> = [
  ...products.map((name) => ({ text: `${name} ke 10 packet add kar do`, intent: "inventory.adjust" })),
  ...products.map((name) => ({ text: `What is the stock of ${name}?`, intent: "inventory.getStock" })),
  ...products.map((name) => ({ text: `${name} ka 10 packet ka order de do`, kind: "clarify" as const, pending: "order-supplier" })),
  ...customers.map((name) => ({ text: `${name} ka kitna udhaar hai?`, intent: "khata.getBalance" })),
  ...customers.map((name) => ({ text: `${name} ke ek sau rupaye udhaar me add kro`, intent: "khata.addEntry" })),
  ...customers.map((name) => ({ text: `${name} ne 50 rupaye wapas diye`, intent: "khata.addEntry" })),
  { text: "aaj ki sale batao", intent: "sales.getDailySummary" },
  { text: "Aaj ki total sale batao", intent: "sales.getDailySummary" },
  { text: "What are today's sales?", intent: "sales.getDailySummary" },
  { text: "Reorder suggestions batao", intent: "inventory.getReorderSuggestions" },
  { text: "Supplier list", intent: "supplier.list" },
  { text: "Open orders dikhao", intent: "orders.getOpen" },
];

describe("Stage 14 offline language variants", () => {
  it("classifies over 60 varied merchant phrases without paid model calls", async () => {
    expect(examples.length).toBeGreaterThan(60);
    const provider = new MockAIProvider(() => "2026-10-10");
    const failures: string[] = [];
    for (const sample of examples) {
      const result = await provider.reason({ text: sample.text });
      if (sample.kind === "clarify") {
        if (result.kind !== "clarify" || result.pending?.kind !== sample.pending) failures.push(`${sample.text}: ${JSON.stringify(result)}`);
      } else if (result.kind !== "tool_call" || result.tool.intent !== sample.intent || !toolCallSchema.safeParse(result.tool).success) {
        failures.push(`${sample.text}: ${JSON.stringify(result)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
