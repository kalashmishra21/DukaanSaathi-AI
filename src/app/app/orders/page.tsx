import { ConnectionState } from "@/components/business/connection-state";
import { OrdersWorkspace } from "@/components/business/orders-workspace";
import { getShopContext } from "@/server/data/context";
import { getOrders } from "@/server/data/queries";

export default async function OrdersPage() {
  const context = await getShopContext();
  if (context.kind !== "ready") return <ConnectionState kind={context.kind === "signed-out" ? "unavailable" : context.kind} />;
  let data: Awaited<ReturnType<typeof getOrders>> | null = null;
  try { data = await getOrders(context); } catch { /* Show a recoverable data state. */ }
  return data ? <OrdersWorkspace {...data} /> : <ConnectionState kind="unavailable" />;
}
