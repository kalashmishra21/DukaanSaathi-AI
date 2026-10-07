import { describe, expect, it } from "vitest";
import { describeMockTurn } from "../src/features/assistant/mock-turn";

describe("assistant mock presentation", () => {
  it("never claims a stock change was saved", () => {
    const turn = describeMockTurn({ kind: "tool_call", tool: { intent: "inventory.adjust", arguments: { product: "Maggi", delta: 20 } } });
    expect(turn.intent).toBe("inventory.adjust");
    expect(turn.reply).toContain("no inventory was changed");
  });

  it("does not invent a customer balance", () => {
    const turn = describeMockTurn({ kind: "tool_call", tool: { intent: "khata.getBalance", arguments: { customer: "Sharma ji" } } });
    expect(turn.reply).toContain("A connected khata is needed");
    expect(turn.reply).not.toMatch(/₹\s*\d/);
  });
});
