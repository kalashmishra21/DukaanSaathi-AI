import { describe, expect, it } from "vitest";
import { createAIProvider } from "../src/lib/ai/provider";
import { MockAIProvider } from "../src/lib/ai/providers/mock";
import { reasoningResultSchema } from "../src/lib/ai/types/tool-call";
import { executeValidatedToolCall } from "../src/server/tools/contracts";

describe("MockAIProvider", () => {
  const provider = new MockAIProvider();

  it("returns deterministic structured inventory intent", async () => {
    await expect(provider.reason({ text: "Maggi ke 20 packet add kar do" })).resolves.toEqual({
      kind: "tool_call",
      tool: { intent: "inventory.adjust", arguments: { product: "Maggi", delta: 20 } },
    });
  });

  it("returns deterministic khata intent", async () => {
    await expect(provider.reason({ text: "Sharma ji ka kitna udhaar hai?" })).resolves.toEqual({
      kind: "tool_call",
      tool: { intent: "khata.getBalance", arguments: { customer: "Sharma ji" } },
    });
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

  it("rejects a live provider until it is explicitly implemented", () => {
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
