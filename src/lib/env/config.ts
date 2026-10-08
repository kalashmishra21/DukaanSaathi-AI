import { z } from "zod";

const providerConfigSchema = z.object({
  AI_PROVIDER: z.enum(["mock", "gnani"]).default("mock"),
  AI_REASONER: z.enum(["mock", "openrouter"]).default("mock"),
  OPENROUTER_MODEL: z.string().regex(/:free$/).default("nvidia/nemotron-3-ultra-550b-a55b:free"),
  OPENROUTER_VISION_MODEL: z.string().regex(/:free$/).default("dots-studio/dots-3-note-preview:free"),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export function readProviderConfig(
  environment: Record<string, string | undefined> = process.env,
): ProviderConfig {
  return providerConfigSchema.parse(environment);
}
