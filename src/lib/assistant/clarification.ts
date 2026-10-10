import { completePending } from "./merchant-language";
import type { ReasoningInput } from "../ai/types/provider";

export function completePendingAmount(input: ReasoningInput) {
  return completePending(input.pending, input.text);
}
