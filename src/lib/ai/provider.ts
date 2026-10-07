import { readProviderConfig } from "../env/config";
import { MockAIProvider } from "./providers/mock";
import type { AIProvider } from "./types/provider";

export function createAIProvider(
  environment: Record<string, string | undefined> = process.env,
): AIProvider {
  readProviderConfig(environment);
  return new MockAIProvider();
}
