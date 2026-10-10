import { reasoningResultSchema, type ReasoningResult } from "../types/tool-call";
import type { AIProvider, ReasoningInput, SpeechResult, TranscriptionInput, TranscriptionResult } from "../types/provider";
import { todayInIndia } from "../../business/calculations";
import { completePending, reasonMerchantCommand } from "../../assistant/merchant-language";

export class MockAIProvider implements AIProvider {
  constructor(private readonly today: () => string = todayInIndia) {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    if (!input.mockTranscript?.trim()) throw new Error("Mock transcription requires an explicit mockTranscript fixture.");
    return { text: input.mockTranscript.trim(), language: input.languageHint };
  }

  async reason(input: ReasoningInput): Promise<ReasoningResult> {
    const pending = completePending(input.pending, input.text);
    if (pending) return reasoningResultSchema.parse(pending);
    return reasoningResultSchema.parse(reasonMerchantCommand(input.text, this.today()));
  }

  async synthesize(text: string): Promise<SpeechResult> {
    return { kind: "text_fallback", text };
  }
}
