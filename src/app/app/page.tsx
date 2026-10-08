import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ConnectionState } from "@/components/business/connection-state";
import { rupees } from "@/lib/business/calculations";
import { getShopContext } from "@/server/data/context";
import { getOverview } from "@/server/data/queries";

export default async function Overview() {
  const context = await getShopContext();
  if (context.kind !== "ready") return <ConnectionState kind={context.kind === "signed-out" ? "unavailable" : context.kind} />;
  let data: Awaited<ReturnType<typeof getOverview>> | null = null;
  try { data = await getOverview(context); } catch { /* Render the unavailable state. */ }
  if (!data) return <ConnectionState kind="unavailable" />;
  return <div className="overview-page business-page">
      <div className="workspace-page-heading"><p className="workspace-eyebrow">OVERVIEW / {context.shop.name.toUpperCase()}</p><h1>Your store,<br /><em>in focus.</em></h1><p>Numbers below come from your connected shop. Saathi uses mock reasoning, while trusted tools handle business changes.</p></div>
      <div className="metric-grid">
        <Link href="/app/sales" className="metric"><span>TODAY&apos;S SALES</span><strong>{rupees(data.todaySales)}</strong><small>{data.saleCount} recorded sale{data.saleCount === 1 ? "" : "s"}</small></Link>
        <Link href="/app/inventory" className="metric"><span>LOW STOCK</span><strong>{data.lowStock.length}</strong><small>At or below reorder threshold</small></Link>
        <Link href="/app/khata" className="metric"><span>KHATA OUTSTANDING</span><strong>{rupees(data.outstanding)}</strong><small>Positive means customers owe the shop</small></Link>
      </div>
      <div className="overview-spotlight"><div className="overview-spotlight-copy"><span className="overview-spotlight-kicker">A FASTER WAY TO ACT</span><h2>Ask Saathi in your own words.</h2><p>Try a stock adjustment or balance question. Only confirmed database results are presented as completed actions.</p><Link className="button button-copper" href="/app/assistant">Open Assistant <ArrowUpRight size={17} aria-hidden="true" /></Link></div><div className="overview-orbit" aria-hidden="true"><div><span>stock</span><span>khata</span><span>sales</span></div></div></div>
      <section className="business-section"><div className="section-heading"><span>RECENT STOCK ACTIVITY</span><Link href="/app/inventory">View inventory →</Link></div>{data.recentMovements.length ? <ul className="activity-list">{data.recentMovements.map((movement) => <li key={movement.id}><span>{data.products.find((product) => product.id === movement.product_id)?.name ?? "Product"}</span><span>{movement.movement_type}</span><strong>{movement.quantity_delta > 0 ? "+" : ""}{movement.quantity_delta}</strong></li>)}</ul> : <p className="business-muted">No movements recorded yet.</p>}</section>
    </div>;
}
