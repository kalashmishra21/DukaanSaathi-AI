import { describe, expect, it } from "vitest";
import { OpenRouterReasoner } from "../src/lib/ai/reasoners/openrouter";

const model = "nvidia/nemotron-3-ultra-550b-a55b:free";
const completion = (name: string, args: unknown) => Response.json({
  choices: [{ message: { tool_calls: [{ function: { name, arguments: JSON.stringify(args) } }] } }],
});

describe("OpenRouter reasoner trust boundary", () => {
  it("proposes one Zod-valid tool call without executing it", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const request: typeof fetch = async (url, options) => {
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer test-key");
      requestBody = JSON.parse(String(options?.body));
      return completion("inventory_adjust", { product: "Maggi", delta: 20 });
    };
    const reasoner = new OpenRouterReasoner("test-key", model, request, () => "2026-10-08");
    await expect(reasoner.reason({ text: "Add 20 packets of Maggi to inventory" })).resolves.toEqual({
      kind: "tool_call", tool: { intent: "inventory.adjust", arguments: { product: "Maggi", delta: 20 } },
    });
    expect(requestBody?.model).toBe(model);
    expect(requestBody?.tool_choice).toBe("auto");
    expect(Array.isArray(requestBody?.tools)).toBe(true);
  });

  it("rejects an invalid amount and extra arguments before any trusted tool", async () => {
    const request: typeof fetch = async () => completion("inventory_adjust", { product: "Maggi", delta: "20", shopId: "other-shop" });
    await expect(new OpenRouterReasoner("test-key", model, request).reason({ text: "Add Maggi" })).rejects.toThrow();
  });

  it("does not turn a text-only completion into a tool action", async () => {
    const request: typeof fetch = async () => Response.json({ choices: [{ message: { content: "Done!" } }] });
    await expect(new OpenRouterReasoner("test-key", model, request).reason({ text: "Update my stock please" })).resolves.toEqual({
      kind: "unsupported", message: "No safe intent was identified.",
    });
  });

  it("rejects multiple actions and upstream errors", async () => {
    const multiple: typeof fetch = async () => Response.json({ choices: [{ message: { tool_calls: [
      { function: { name: "inventory_adjust", arguments: '{"product":"Maggi","delta":20}' } },
      { function: { name: "khata_getBalance", arguments: '{"customer":"Sharma ji"}' } },
    ] } }] });
    await expect(new OpenRouterReasoner("test-key", model, multiple).reason({ text: "Do both" })).rejects.toThrow("multiple actions");
    const unavailable: typeof fetch = async () => new Response(null, { status: 429 });
    await expect(new OpenRouterReasoner("test-key", model, unavailable).reason({ text: "Maggi" })).rejects.toThrow("429");
  });

  it("validates new khata, repayment and shopping-list tools", async () => {
    const scenarios = [
      ["khata_openAccount", { customer: "Nandini", amountRupees: 100 }, "khata.openAccount"],
      ["khata_addEntry", { customer: "Nandini", type: "received", amountRupees: 50 }, "khata.addEntry"],
      ["inventory_checkList", { items: [{ product: "Maggi", quantity: 2 }] }, "inventory.checkList"],
    ] as const;
    for (const [name, args, intent] of scenarios) {
      const request: typeof fetch = async () => completion(name, args);
      await expect(new OpenRouterReasoner("test-key", model, request).reason({ text: "Merchant request" })).resolves.toMatchObject({
        kind: "tool_call", tool: { intent, arguments: args },
      });
    }
  });

  it("asks for an opening amount and completes the follow-up without a second model call", async () => {
    const unavailable: typeof fetch = async () => { throw new Error("Should not call model"); };
    const reasoner = new OpenRouterReasoner("test-key", model, unavailable);
    const first = await reasoner.reason({ text: "Nandini naam se customer add karo udhaar wala" });
    expect(first).toMatchObject({ kind: "clarify", pending: { customer: "Nandini" } });
    if (first.kind !== "clarify") throw new Error("Expected clarification");
    await expect(reasoner.reason({ text: "100 rupaye", pending: first.pending })).resolves.toMatchObject({
      kind: "tool_call", tool: { intent: "khata.openAccount", arguments: { customer: "Nandini", amountRupees: 100 } },
    });
  });

  it("recognizes exact merchant commands safely when the free provider is unavailable", async () => {
    const unavailable: typeof fetch = async () => { throw new Error("Provider unavailable"); };
    const reasoner = new OpenRouterReasoner("test-key", model, unavailable, () => "2026-10-08");
    await expect(reasoner.reason({ text: "Nandini ke naam se 100 rupaye ka naya udhaar khata bana do" })).resolves.toMatchObject({
      kind: "tool_call", tool: { intent: "khata.openAccount", arguments: { customer: "Nandini", amountRupees: 100 } },
    });
    await expect(reasoner.reason({ text: "Nandini ne 50 rupaye wapas diye" })).resolves.toMatchObject({
      kind: "tool_call", tool: { intent: "khata.addEntry", arguments: { type: "received", amountRupees: 50 } },
    });
  });
});
