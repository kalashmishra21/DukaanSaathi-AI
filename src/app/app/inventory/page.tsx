import { ConnectionState } from "@/components/business/connection-state";
import { InventoryWorkspace } from "@/components/business/inventory-workspace";
import { getShopContext } from "@/server/data/context";
import { getInventory } from "@/server/data/queries";

export default async function InventoryPage() {
  const context = await getShopContext();
  if (context.kind !== "ready") return <ConnectionState kind={context.kind === "signed-out" ? "unavailable" : context.kind} />;
  let data: Awaited<ReturnType<typeof getInventory>> | null = null;
  try { data = await getInventory(context); } catch { /* Render the unavailable state. */ }
  return data ? <InventoryWorkspace {...data} /> : <ConnectionState kind="unavailable" />;
}
