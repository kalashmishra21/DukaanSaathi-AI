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
    await expect(reasoner.reason({ text: "Maggi ke 20 packet add kar do" })).resolves.toEqual({
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
    await expect(new OpenRouterReasoner("test-key", model, request).reason({ text: "Maggi ke 20 packet add kar do" })).resolves.toEqual({
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
});
