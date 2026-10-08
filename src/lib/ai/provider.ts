import { readProviderConfig } from "../env/config";
import { MockAIProvider } from "./providers/mock";
import { GnaniVoiceProvider } from "./providers/gnani-voice";
import type { AIProvider } from "./types/provider";

export function createAIProvider(
  environment: Record<string, string | undefined> = process.env,
): AIProvider {
  const config = readProviderConfig(environment);
  if (config.AI_PROVIDER === "mock") return new MockAIProvider();
  if (!config.GNANI_API_KEY?.trim()) throw new Error("GNANI_API_KEY is required when AI_PROVIDER=gnani.");
  return new GnaniVoiceProvider(config.GNANI_API_KEY);
}
