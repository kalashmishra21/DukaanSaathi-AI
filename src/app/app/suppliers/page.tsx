import { ConnectionState } from "@/components/business/connection-state";
import { SuppliersWorkspace } from "@/components/business/suppliers-workspace";
import { getShopContext } from "@/server/data/context";
import { getSuppliers } from "@/server/data/queries";

export default async function SuppliersPage() {
  const context = await getShopContext();
  if (context.kind !== "ready") return <ConnectionState kind={context.kind === "signed-out" ? "unavailable" : context.kind} />;
  let data: Awaited<ReturnType<typeof getSuppliers>> | null = null;
  try { data = await getSuppliers(context); } catch { /* Show a recoverable data state. */ }
  return data ? <SuppliersWorkspace suppliers={data} /> : <ConnectionState kind="unavailable" />;
}
