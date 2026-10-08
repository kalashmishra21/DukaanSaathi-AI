"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, PackageCheck, Plus } from "lucide-react";
import { rupees } from "@/lib/business/calculations";
import { reorderSuggestions } from "@/lib/business/reorder";
import type { Product, PurchaseOrder, PurchaseOrderItem, Supplier } from "@/lib/business/schemas";
import { useBusinessMutation } from "./use-business-mutation";

type Line = { productId: string; quantity: number; unitCost: number | null };

export function OrdersWorkspace({ suppliers, products, orders, items }: {
  suppliers: Supplier[]; products: Product[]; orders: PurchaseOrder[]; items: PurchaseOrderItem[];
}) {
  const availableProducts = products.filter((product) => !product.archived_at);
  const suggestions = reorderSuggestions(availableProducts);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const { busy, error, notice, run } = useBusinessMutation();
  const visibleOrders = statusFilter === "all" ? orders : orders.filter((order) => order.status === statusFilter);
  const duplicate = new Set(lines.map((line) => line.productId)).size !== lines.length;
  const estimated = lines.reduce((sum, line) => sum + line.quantity * (line.unitCost ?? products.find((product) => product.id === line.productId)?.cost_price ?? products.find((product) => product.id === line.productId)?.selling_price ?? 0), 0);

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const note = String(new FormData(form).get("note") ?? "").trim();
    if (!supplierId || !lines.length || duplicate) return;
    if (await run({ kind: "order.createDraft", supplierId, items: lines, note }, "Purchase order draft saved. No supplier has been contacted.")) { setLines([]); form.reset(); }
  }

  async function transition(order: PurchaseOrder, action: "place" | "receive" | "cancel") {
    if (action === "receive" && !window.confirm("Confirm goods were received? This will add each ordered quantity to inventory.")) return;
    await run({ kind: "order.transition", id: order.id, action }, action === "receive" ? "Goods received and stock movements saved." : action === "place" ? "Order marked placed. Contact the supplier separately." : "Order cancelled. No stock changed.");
  }

  return <div className="business-page">
    <div className="workspace-page-heading"><p className="workspace-eyebrow">ORDERS / CONNECTED</p><h1>Reorder with<br /><em>clarity.</em></h1><p>Build an internal purchase order from your shelf needs. Mark it placed after contacting the supplier; stock increases only when you confirm receipt.</p></div>
    <section className="business-section reorder-section"><div className="section-heading"><span>REORDER SUGGESTIONS / {suggestions.length}</span><span>AT OR BELOW THRESHOLD</span></div>
      {suggestions.length ? <div className="reorder-list">{suggestions.map((item) => <div key={item.productId}><div><strong>{item.name}</strong><span>{item.stock} on shelf · threshold {item.threshold}</span></div><strong>+{item.quantity}</strong><button type="button" onClick={() => setLines((current) => current.some((line) => line.productId === item.productId) ? current : [...current, { productId: item.productId, quantity: item.quantity, unitCost: item.unitCost }])}>Add to draft</button></div>)}</div>
        : <p className="business-muted">No products are at or below their reorder threshold.</p>}
    </section>
    <div className="business-columns">
      <section className="business-section business-form-panel"><div className="section-heading"><span>NEW PURCHASE ORDER</span><span>INTERNAL DRAFT</span></div>
        {suppliers.length && availableProducts.length ? <form className="business-form" onSubmit={(event) => void createDraft(event)}><label>Supplier<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
          {lines.map((line, index) => <div className="order-line" key={index}><label>Product<select value={line.productId} onChange={(event) => setLines((current) => current.map((item, position) => position === index ? { ...item, productId: event.target.value, unitCost: null } : item))}>{availableProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label>Quantity<input type="number" min="1" max="10000" required value={line.quantity} onChange={(event) => setLines((current) => current.map((item, position) => position === index ? { ...item, quantity: Number(event.target.value) } : item))} /></label><label>Unit cost ₹<input type="number" min="0" step="0.01" value={line.unitCost ?? ""} placeholder="Product cost" onChange={(event) => setLines((current) => current.map((item, position) => position === index ? { ...item, unitCost: event.target.value === "" ? null : Number(event.target.value) } : item))} /></label><button className="line-remove" type="button" onClick={() => setLines((current) => current.filter((_, position) => position !== index))}>Remove</button></div>)}
          <button className="text-button" type="button" disabled={lines.length >= availableProducts.length} onClick={() => setLines((current) => [...current, { productId: availableProducts.find((product) => !current.some((line) => line.productId === product.id))?.id ?? availableProducts[0].id, quantity: 1, unitCost: null }])}><Plus size={14} aria-hidden="true" /> Add product</button>
          {duplicate && <p className="form-error" role="alert">Each product can appear only once.</p>}
          <label>Order note (optional)<input name="note" maxLength={300} placeholder="Delivery or supplier reference" /></label><div className="sale-total"><span>ESTIMATED COST</span><strong>{rupees(estimated)}</strong><small>Based on saved unit costs; not a payment or supplier invoice.</small></div><button className="button button-copper" type="submit" disabled={busy || !lines.length || duplicate}>Save draft</button>
        </form> : <p className="business-muted">Add a supplier and a product before drafting an order. <Link href="/app/suppliers">Open suppliers <ArrowUpRight size={14} aria-hidden="true" /></Link></p>}
      </section>
      <section className="business-section"><div className="section-heading"><span>PURCHASE ORDER HISTORY / {orders.length}</span></div><label className="business-filter">Show<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All orders</option><option value="draft">Draft</option><option value="placed">Placed</option><option value="received">Received</option><option value="cancelled">Cancelled</option></select></label>
        {visibleOrders.length ? <ul className="order-history">{visibleOrders.map((order) => { const orderItems = items.filter((item) => item.order_id === order.id); const supplier = suppliers.find((item) => item.id === order.supplier_id); return <li key={order.id}><div className="order-history-head"><strong>{supplier?.name ?? "Supplier"}</strong><span data-status={order.status}>{order.status}</span></div><p>{orderItems.map((item) => `${products.find((product) => product.id === item.product_id)?.name ?? "Product"} × ${item.quantity}`).join(" · ") || "No items"}</p><div className="order-history-foot"><span>{new Date(order.created_at).toLocaleDateString("en-IN")} · {rupees(orderItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0))}</span><div>{order.status === "draft" && <button type="button" disabled={busy} onClick={() => void transition(order, "place")}>Mark placed</button>}{order.status === "placed" && <button type="button" disabled={busy} onClick={() => void transition(order, "receive")}><PackageCheck size={15} aria-hidden="true" /> Receive goods</button>}{["draft", "placed"].includes(order.status) && <button type="button" disabled={busy} onClick={() => void transition(order, "cancel")}>Cancel</button>}</div></div></li>; })}</ul>
          : <p className="business-muted">{statusFilter === "all" ? "No purchase orders yet. Use a reorder suggestion to start a draft." : `No ${statusFilter} orders.`}</p>}
      </section>
    </div>
    {notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
