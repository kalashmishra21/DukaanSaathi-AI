import { ConnectionState } from "@/components/business/connection-state";
import { SalesWorkspace } from "@/components/business/sales-workspace";
import { getShopContext } from "@/server/data/context";
import { getSales } from "@/server/data/queries";

export default async function SalesPage() {
  const context = await getShopContext();
  if (context.kind !== "ready") return <ConnectionState kind={context.kind === "signed-out" ? "unavailable" : context.kind} />;
  let data: Awaited<ReturnType<typeof getSales>> | null = null;
  try { data = await getSales(context); } catch { /* Render the unavailable state. */ }
  return data ? <SalesWorkspace {...data} /> : <ConnectionState kind="unavailable" />;
}
