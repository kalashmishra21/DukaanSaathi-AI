import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";
import { getShopContext } from "@/server/data/context";
import { readProviderConfig } from "@/lib/env/config";
import { SupabaseBusinessRepository } from "@/server/data/tool-repository";

export default async function AssistantPage() {
  const context = await getShopContext();
  const config = readProviderConfig();
  let initialPending = null;
  if (context.kind === "ready") {
    try { initialPending = (await new SupabaseBusinessRepository(context).pendingClarification())?.pending ?? null; }
    catch { initialPending = null; }
  }
  return <AssistantWorkspace connected={context.kind === "ready"} providerMode={config.AI_PROVIDER} reasonerMode={config.AI_REASONER} voiceAvailable={Boolean(process.env.GNANI_API_KEY)} initialPending={initialPending} />;
}
