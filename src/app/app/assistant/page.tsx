import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";
import { getShopContext } from "@/server/data/context";
import { readProviderConfig } from "@/lib/env/config";

export default async function AssistantPage() {
  const context = await getShopContext();
  const config = readProviderConfig();
  return <AssistantWorkspace connected={context.kind === "ready"} providerMode={config.AI_PROVIDER} reasonerMode={config.AI_REASONER} voiceAvailable={Boolean(process.env.GNANI_API_KEY)} />;
}
