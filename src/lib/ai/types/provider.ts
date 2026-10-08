import type { ReasoningResult } from "./tool-call";
import type { z } from "zod";
import type { pendingClarificationSchema, recentTurnSchema } from "./tool-call";

export type TranscriptionInput = {
  audio: Uint8Array;
  mimeType?: string;
  languageHint?: string;
  mockTranscript?: string;
};

export type TranscriptionResult = {
  text: string;
  language?: string;
};

export type ReasoningInput = {
  text: string;
  locale?: string;
  recent?: z.infer<typeof recentTurnSchema>[];
  pending?: z.infer<typeof pendingClarificationSchema> | null;
};

export type SpeechResult =
  | { kind: "audio"; bytes: Uint8Array; mimeType: string }
  | { kind: "text_fallback"; text: string };

export interface AIProvider {
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
  reason(input: ReasoningInput): Promise<ReasoningResult>;
  synthesize(text: string): Promise<SpeechResult>;
}
