import { afterEach, describe, expect, it, vi } from "vitest";
import { createAIProvider } from "../src/lib/ai/provider";
import { MockAIProvider } from "../src/lib/ai/providers/mock";
import { reasoningResultSchema } from "../src/lib/ai/types/tool-call";
import { executeValidatedToolCall } from "../src/server/tools/contracts";

describe("MockAIProvider", () => {
  afterEach(() => vi.unstubAllEnvs());
  const provider = new MockAIProvider();

  it("returns deterministic structured inventory intent", async () => {
    await expect(provider.reason({ text: "Maggi ke 20 packet add kar do" })).resolves.toEqual({
      kind: "tool_call",
      tool: { intent: "inventory.adjust", arguments: { product: "Maggi", delta: 20 } },
    });
  });

  it("asks for missing stock details without proposing a mutation", async () => {
    await expect(provider.reason({ text: "Kuchh maal adjust kar do" })).resolves.toEqual({
      kind: "clarify", intent: "inventory.adjust",
      question: "Which product and how many units should I add or remove? Nothing was changed.",
    });
  });

  it("recognizes common English and Hindi stock and sales phrases offline", async () => {
    const fixed = new MockAIProvider(() => "2026-10-09");
    await expect(fixed.reason({ text: "Add 2 packets of Maggi to inventory" })).resolves.toMatchObject({
      kind: "tool_call", tool: { intent: "inventory.adjust", arguments: { product: "Maggi", delta: 2 } },
    });
    await expect(fixed.reason({ text: "What is the stock of Maggi?" })).resolves.toMatchObject({
      kind: "tool_call", tool: { intent: "inventory.getStock", arguments: { product: "Maggi" } },
    });
    await expect(fixed.reason({ text: "मैगी का स्टॉक बताओ" })).resolves.toMatchObject({
      kind: "tool_call", tool: { intent: "inventory.getStock", arguments: { product: "Maggi" } },
    });
    await expect(fixed.reason({ text: "How much does Sharma ji owe?" })).resolves.toMatchObject({
      kind: "tool_call", tool: { intent: "khata.getBalance", arguments: { customer: "Sharma ji" } },
    });
    for (const text of ["What are today's sales?", "आज की बिक्री बताओ"]) {
      await expect(fixed.reason({ text })).resolves.toMatchObject({
        kind: "tool_call", tool: { intent: "sales.getDailySummary", arguments: { date: "2026-10-09" } },
      });
    }
  });

  it("returns deterministic khata intent", async () => {
    await expect(provider.reason({ text: "Sharma ji ka kitna udhaar hai?" })).resolves.toEqual({
      kind: "tool_call",
      tool: { intent: "khata.getBalance", arguments: { customer: "Sharma ji" } },
    });
  });

  it("opens Nandini's khata directly and via a safe amount clarification", async () => {
    await expect(provider.reason({ text: "Nandini ke naam se 100 rupaye ka naya udhaar khata bana do" })).resolves.toMatchObject({
      kind: "tool_call", tool: { intent: "khata.openAccount", arguments: { customer: "Nandini", amountRupees: 100 } },
    });
    const first = await provider.reason({ text: "Nandini naam se customer add karo udhaar wala" });
    expect(first).toMatchObject({ kind: "clarify", pending: { customer: "Nandini" } });
    if (first.kind !== "clarify") throw new Error("Expected clarification");
    await expect(provider.reason({ text: "100 rupaye", pending: first.pending })).resolves.toMatchObject({
      kind: "tool_call", tool: { intent: "khata.openAccount", arguments: { customer: "Nandini", amountRupees: 100 } },
    });
    await expect(provider.reason({ text: "kal aana", pending: first.pending })).resolves.toMatchObject({ kind: "unsupported" });
  });

  it("uses a received ledger entry for Nandini's repayment", async () => {
    await expect(provider.reason({ text: "Nandini ne 50 rupaye wapas diye" })).resolves.toMatchObject({
      kind: "tool_call", tool: { intent: "khata.addEntry", arguments: { customer: "Nandini", type: "received", amountRupees: 50 } },
    });
  });

  it("turns a text shopping list into a read-only batch inventory check", async () => {
    await expect(provider.reason({ text: "Shopping list: Maggi 2, Parle-G 3" })).resolves.toMatchObject({
      kind: "tool_call", tool: { intent: "inventory.checkList", arguments: { items: [
        { product: "Maggi", quantity: 2 }, { product: "Parle-G", quantity: 3 },
      ] } },
    });
  });

  it("handles supported Hindi transcripts after Prisma transcription", async () => {
    await expect(provider.reason({ text: "मैगी के २० पैकेट जोड़ कर दो।" })).resolves.toEqual({
      kind: "tool_call", tool: { intent: "inventory.adjust", arguments: { product: "Maggi", delta: 20 } },
    });
    await expect(provider.reason({ text: "शर्मा जी का कितना उधार है?" })).resolves.toMatchObject({
      kind: "tool_call", tool: { intent: "khata.getBalance" },
    });
  });

  it("returns a date-scoped sales intent from the mock phrase", async () => {
    const fixed = new MockAIProvider(() => "2026-10-07");
    await expect(fixed.reason({ text: "Aaj ki sale batao" })).resolves.toEqual({
      kind: "tool_call", tool: { intent: "sales.getDailySummary", arguments: { date: "2026-10-07" } },
    });
    await expect(fixed.reason({ text: "Aaj ki total sale batao" })).resolves.toMatchObject({ kind: "tool_call" });
  });

  it("rejects invalid structured output", () => {
    expect(() => reasoningResultSchema.parse({
      kind: "tool_call",
      tool: { intent: "inventory.adjust", arguments: { product: "Maggi", delta: "20" } },
    })).toThrow();
  });

  it("runs in mock mode without Gnani credentials", async () => {
    const offlineProvider = createAIProvider({ AI_PROVIDER: "mock" });
    await expect(offlineProvider.synthesize("Namaste")).resolves.toEqual({ kind: "text_fallback", text: "Namaste" });
  });

  it("requires a server-side key for the Gnani voice provider", () => {
    vi.stubEnv("GNANI_API_KEY", "");
    expect(() => createAIProvider({ AI_PROVIDER: "gnani" })).toThrow();
  });

  it("never calls a trusted tool for invalid model arguments", async () => {
    let called = false;
    const executor = {
      async execute() {
        called = true;
        return { ok: true as const, data: null };
      },
    };

    await expect(executeValidatedToolCall({
      intent: "inventory.adjust",
      arguments: { product: "Maggi", delta: "20" },
    }, executor)).rejects.toThrow();
    expect(called).toBe(false);
  });
});
