import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../src/lib/ai/providers/mock";

const provider = new MockAIProvider(() => "2026-10-10");

describe("Stage 14 merchant regressions", () => {
  it("lets a new sales request interrupt an unanswered Bread price question", async () => {
    const bread = await provider.reason({ text: "50 packet of Bread add kro new inventory h ye" });
    expect(bread).toMatchObject({ kind: "clarify", pending: { kind: "product-create-price", product: "Bread", openingStock: 50 } });
    if (bread.kind !== "clarify") throw new Error("Expected Bread price question");
    expect(await provider.reason({ text: "Aaj ki sale batao", pending: bread.pending })).toMatchObject({
      kind: "tool_call", tool: { intent: "sales.getDailySummary", arguments: { date: "2026-10-10" } },
    });
  });

  it("keeps an unrelated supplier or sales command out of a pending product action", async () => {
    const choice = await provider.reason({ text: "Ice Cream 10 unit" });
    if (choice.kind !== "clarify" || !choice.pending) throw new Error("Expected product choice");
    expect(await provider.reason({ text: "Amul Milk ka 10 packet ka order de do", pending: choice.pending }))
      .toMatchObject({ kind: "clarify", pending: { kind: "order-supplier" } });
    expect(await provider.reason({ text: "new", pending: choice.pending }))
      .toMatchObject({ kind: "clarify", pending: { kind: "product-create-price" } });
  });

  it.each([
    ["Amul Milk ka 10 packet ka order de do", "clarify", "order-supplier"],
    ["ice creame ka 10 unit add kr do inventory me", "tool_call", "inventory.adjust"],
    ["Ice Cream 10 unit", "clarify", "product-action-choice"],
    ["Aaj ki sale batao", "tool_call", "sales.getDailySummary"],
    ["Mahi ke ek sau rupaye udhaar me add kro", "tool_call", "khata.addEntry"],
  ])("interprets %s safely", async (text, kind, intentOrPending) => {
    const result = await provider.reason({ text });
    expect(result.kind).toBe(kind);
    if (result.kind === "tool_call") expect(result.tool.intent).toBe(intentOrPending);
    if (result.kind === "clarify") expect(result.pending?.kind).toBe(intentOrPending);
  });
});
