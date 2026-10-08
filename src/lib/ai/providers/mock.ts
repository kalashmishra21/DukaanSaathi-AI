import { reasoningResultSchema } from "../types/tool-call";
import type { AIProvider, ReasoningInput, SpeechResult, TranscriptionInput, TranscriptionResult } from "../types/provider";
import type { ReasoningResult } from "../types/tool-call";
import { todayInIndia } from "../../business/calculations";

export class MockAIProvider implements AIProvider {
  constructor(private readonly today: () => string = todayInIndia) {}
  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    if (!input.mockTranscript?.trim()) {
      throw new Error("Mock transcription requires an explicit mockTranscript fixture.");
    }

    return { text: input.mockTranscript.trim(), language: input.languageHint };
  }

  async reason(input: ReasoningInput): Promise<ReasoningResult> {
    const text = input.text.trim()
      .replace(/^मैगी के ([0-9०-९]+) पैकेट (?:ऐड|एड|जोड़) कर दो[.!?।]?$/u, (_, amount: string) =>
        `Maggi ke ${amount.replace(/[०-९]/gu, (digit) => String("०१२३४५६७८९".indexOf(digit)))} packet add kar do`)
      .replace(/^शर्मा जी का कितना उधार है[.!?।]?$/u, "Sharma ji ka kitna udhaar hai?")
      .replace(/^आज की (?:कुल|टोटल) सेल बताओ[.!?।]?$/u, "Aaj ki total sale batao");
    const inventory = /^maggi ke (\d+) packet add kar do[.!?]?$/i.exec(text);

    if (inventory) {
      const delta = Number(inventory[1]);
      if (!Number.isInteger(delta) || delta < 1 || delta > 100000) return reasoningResultSchema.parse({ kind: "unsupported", message: "Quantity is outside the demo range." });
      return reasoningResultSchema.parse({
        kind: "tool_call",
        tool: { intent: "inventory.adjust", arguments: { product: "Maggi", delta } },
      });
    }

    const stock = /^(.+?) ka stock batao[.!?]?$/i.exec(text);
    if (stock) return reasoningResultSchema.parse({
      kind: "tool_call", tool: { intent: "inventory.getStock", arguments: { product: stock[1] } },
    });

    if (/^sharma ji ka kitna udhaar hai[.!?]?$/i.test(text)) {
      return reasoningResultSchema.parse({
        kind: "tool_call",
        tool: { intent: "khata.getBalance", arguments: { customer: "Sharma ji" } },
      });
    }

    const khataEntry = /^sharma ji ko (\d+) rupaye udhaar likh do[.!?]?$/i.exec(text);
    if (khataEntry) {
      const amount = Number(khataEntry[1]);
      if (!Number.isInteger(amount) || amount < 1 || amount > 10000000) return reasoningResultSchema.parse({ kind: "unsupported", message: "Amount is outside the demo range." });
      return reasoningResultSchema.parse({
        kind: "tool_call", tool: { intent: "khata.addEntry", arguments: { customer: "Sharma ji", amountRupees: amount } },
      });
    }

    if (/^aaj ki (?:total )?sale batao[.!?]?$/i.test(text)) return reasoningResultSchema.parse({
      kind: "tool_call", tool: { intent: "sales.getDailySummary", arguments: { date: this.today() } },
    });

    return reasoningResultSchema.parse({
      kind: "unsupported",
      message: "This request is not available in the current mock.",
    });
  }

  async synthesize(text: string): Promise<SpeechResult> {
    return { kind: "text_fallback", text };
  }
}
