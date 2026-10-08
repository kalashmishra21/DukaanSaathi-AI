import { pendingClarificationSchema, reasoningResultSchema, type ReasoningResult } from "../ai/types/tool-call";
import type { ReasoningInput } from "../ai/types/provider";

export function completePendingAmount(input: ReasoningInput): ReasoningResult | null {
  const pending = pendingClarificationSchema.safeParse(input.pending);
  if (!pending.success) return null;
  const normalized = input.text.trim().replace(/[०-९]/gu, (digit) => String("०१२३४५६७८९".indexOf(digit)));
  const match = /^(?:₹\s*)?(\d{1,8})(?:\s*(?:रुपये|रुपए|rupaye|rs\.?|rupees))?[.!?।]?$/iu.exec(normalized);
  if (!match) return null;
  return reasoningResultSchema.parse({
    kind: "tool_call",
    tool: { intent: "khata.openAccount", arguments: { customer: pending.data.customer, amountRupees: Number(match[1]) } },
  });
}
