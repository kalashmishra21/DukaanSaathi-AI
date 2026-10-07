export const voiceStates = {
  idle: { label: "Ready", detail: "Type a request or play the voice demo." },
  listening: { label: "Listening", detail: "Sample voice flow in progress. No microphone is recording." },
  transcribing: { label: "Transcribing", detail: "Turning the demo phrase into text." },
  reasoning: { label: "Understanding", detail: "The mock provider is selecting a structured intent." },
  executing: { label: "Preparing action", detail: "Previewing the proposed action. No business tool is running." },
  speaking: { label: "Responding", detail: "Showing the mock response as text." },
  error: { label: "Try again", detail: "The mock request did not complete." },
} as const;

export type VoiceState = keyof typeof voiceStates;
