import { z } from "zod";

const providerConfigSchema = z.object({
  AI_PROVIDER: z.enum(["mock", "gnani"]).default("mock"),
  GNANI_API_KEY: z.string().optional(),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export function readProviderConfig(
  environment: Record<string, string | undefined> = process.env,
): ProviderConfig {
  return providerConfigSchema.parse(environment);
}
