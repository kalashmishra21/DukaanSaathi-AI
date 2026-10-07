import { reasoningResultSchema } from "../types/tool-call";
import type { AIProvider, ReasoningInput, SpeechResult, TranscriptionInput, TranscriptionResult } from "../types/provider";
import type { ReasoningResult } from "../types/tool-call";

export class MockAIProvider implements AIProvider {
  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    if (!input.mockTranscript?.trim()) {
      throw new Error("Mock transcription requires an explicit mockTranscript fixture.");
    }

    return { text: input.mockTranscript.trim(), language: input.languageHint };
  }

  async reason(input: ReasoningInput): Promise<ReasoningResult> {
    const text = input.text.trim();
    const inventory = /^maggi ke (\d+) packet add kar do[.!?]?$/i.exec(text);

    if (inventory) {
      return reasoningResultSchema.parse({
        kind: "tool_call",
        tool: { intent: "inventory.adjust", arguments: { product: "Maggi", delta: Number(inventory[1]) } },
      });
    }

    if (/^sharma ji ka kitna udhaar hai[.!?]?$/i.test(text)) {
      return reasoningResultSchema.parse({
        kind: "tool_call",
        tool: { intent: "khata.getBalance", arguments: { customer: "Sharma ji" } },
      });
    }

    return reasoningResultSchema.parse({
      kind: "unsupported",
      message: "This request is not available in the current mock.",
    });
  }

  async synthesize(text: string): Promise<SpeechResult> {
    return { kind: "text_fallback", text };
  }
}
