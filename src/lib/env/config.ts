import { z } from "zod";

const providerConfigSchema = z.object({
  AI_PROVIDER: z.literal("mock").default("mock"),
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export function readProviderConfig(
  environment: Record<string, string | undefined> = process.env,
): ProviderConfig {
  return providerConfigSchema.parse(environment);
}
