import { readProviderConfig } from "../env/config";
import { MockAIProvider } from "./providers/mock";
import { GnaniVoiceProvider } from "./providers/gnani-voice";
import { OpenRouterReasoner } from "./reasoners/openrouter";
import type { AIProvider } from "./types/provider";

export function createAIProvider(
  environment: Record<string, string | undefined> = process.env,
): AIProvider {
  const config = readProviderConfig(environment);
  const voice = config.AI_PROVIDER === "mock" ? new MockAIProvider() : (() => {
    if (!process.env.GNANI_API_KEY?.trim()) throw new Error("GNANI_API_KEY is required when AI_PROVIDER=gnani.");
    return new GnaniVoiceProvider(process.env.GNANI_API_KEY);
  })();
  if (config.AI_REASONER === "mock") return voice;
  if (!process.env.OPENROUTER_API_KEY?.trim()) throw new Error("OPENROUTER_API_KEY is required when AI_REASONER=openrouter.");
  const reasoner = new OpenRouterReasoner(process.env.OPENROUTER_API_KEY, config.OPENROUTER_MODEL);
  return {
    transcribe: (input) => voice.transcribe(input),
    reason: (input) => reasoner.reason(input),
    synthesize: (text) => voice.synthesize(text),
  };
}
