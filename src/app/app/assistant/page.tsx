import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";
import { getShopContext } from "@/server/data/context";

export default async function AssistantPage() {
  const context = await getShopContext();
  return <AssistantWorkspace connected={context.kind === "ready"} />;
}
