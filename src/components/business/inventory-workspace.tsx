"use client";

import { useState, type FormEvent } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { rupees } from "@/lib/business/calculations";
import type { InventoryMovement, Product } from "@/lib/business/schemas";
import { useBusinessMutation } from "./use-business-mutation";

export function InventoryWorkspace({ products, movements, movementNames }: { products: Product[]; movements: InventoryMovement[]; movementNames: Record<string, string> }) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const { busy, error, notice, run } = useBusinessMutation();

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const base = {
      name: String(values.get("name") || "").trim(), sku: String(values.get("sku") || "").trim(),
      unit: String(values.get("unit") || "").trim(),
      sellingPrice: Number(values.get("sellingPrice")),
      costPrice: values.get("costPrice") ? Number(values.get("costPrice")) : null,
      threshold: Number(values.get("threshold")),
    };
    const action = editing
      ? { kind: "product.edit" as const, id: editing.id, ...base }
      : { kind: "product.create" as const, ...base, costPrice: base.costPrice ?? undefined, openingStock: Number(values.get("openingStock")) };
    if (await run(action, editing ? "Product updated." : "Product added with opening stock.")) { setEditing(null); form.reset(); }
  }

  async function saveAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjusting) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    if (await run({ kind: "product.adjust", id: adjusting.id, delta: Number(values.get("delta")), note: String(values.get("note") || "") }, "Stock adjustment saved.")) {
      setAdjusting(null); form.reset();
    }
  }

  async function archiveProduct(product: Product) {
    if (product.current_stock !== 0 || !window.confirm(`Archive ${product.name}? Its sale and movement history will remain.`)) return;
    await run({ kind: "product.archive", id: product.id }, "Product archived. Its history is retained.");
  }

  return <div className="business-page">
    <div className="workspace-page-heading"><p className="workspace-eyebrow">INVENTORY / CONNECTED</p><h1>Know what is<br /><em>on the shelf.</em></h1><p>Stock changes are recorded with a movement. A sale reduces stock in the same database transaction.</p></div>
    <div className="business-columns">
      <section className="business-section">
        <div className="section-heading"><span>PRODUCTS / {products.length}</span><span>{products.filter((product) => product.current_stock <= product.low_stock_threshold).length} low stock</span></div>
        {products.length ? <div className="table-scroll"><table className="business-table"><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small>{product.sku || product.unit}</small></td><td>{rupees(product.selling_price)}</td><td><span className={product.current_stock <= product.low_stock_threshold ? "stock-low" : "stock-ok"}>{product.current_stock} {product.unit}{product.current_stock <= product.low_stock_threshold ? " · Low" : ""}</span></td><td><div className="row-actions"><button type="button" onClick={() => { setEditing(product); setAdjusting(null); }}>Edit</button><button type="button" onClick={() => { setAdjusting(product); setEditing(null); }}>Adjust</button><button type="button" disabled={busy || product.current_stock !== 0} title={product.current_stock === 0 ? "Archive while preserving history" : "Reduce stock to zero before archiving"} onClick={() => void archiveProduct(product)}>Archive</button></div></td></tr>)}</tbody></table></div> : <p className="business-muted">No products yet. Add the first product using the form.</p>}
      </section>
      <section className="business-section business-form-panel">
        <div className="section-heading"><span>{editing ? "EDIT PRODUCT" : "ADD PRODUCT"}</span>{editing && <button type="button" onClick={() => setEditing(null)}>Cancel</button>}</div>
        <form key={editing?.id ?? "new"} className="business-form" onSubmit={(event) => void saveProduct(event)}>
          <label>Name<input name="name" required maxLength={120} defaultValue={editing?.name} placeholder="e.g. Maggi" /></label>
          <div className="form-grid"><label>SKU (optional)<input name="sku" maxLength={60} defaultValue={editing?.sku ?? ""} /></label><label>Unit<input name="unit" required defaultValue={editing?.unit ?? "packet"} /></label></div>
          <div className="form-grid"><label>Selling price ₹<input name="sellingPrice" type="number" min="0" step="0.01" required defaultValue={editing?.selling_price} /></label><label>Cost price ₹<input name="costPrice" type="number" min="0" step="0.01" defaultValue={editing?.cost_price ?? ""} /></label></div>
          <div className="form-grid"><label>Low stock threshold<input name="threshold" type="number" min="0" step="1" required defaultValue={editing?.low_stock_threshold ?? 5} /></label>{!editing && <label>Opening stock<input name="openingStock" type="number" min="0" step="1" required defaultValue={0} /></label>}</div>
          <button className="button button-dark" type="submit" disabled={busy}><Plus size={16} aria-hidden="true" /> {editing ? "Save product" : "Add product"}</button>
        </form>
      </section>
    </div>
    {adjusting && <section className="business-section business-adjust" aria-labelledby="adjust-heading"><div className="section-heading"><span>STOCK MOVEMENT</span><button type="button" onClick={() => setAdjusting(null)}>Close</button></div><h2 id="adjust-heading">Adjust {adjusting.name}</h2><p>Current stock: {adjusting.current_stock} {adjusting.unit}. Use a positive number to add or a negative number to remove.</p><form className="business-form inline-form" onSubmit={(event) => void saveAdjustment(event)}><label>Change in units<input name="delta" type="number" step="1" required placeholder="+20 or -3" /></label><label>Note<input name="note" maxLength={300} placeholder="Reason for change" /></label><button className="button button-copper" type="submit" disabled={busy}><RotateCcw size={16} aria-hidden="true" /> Save movement</button></form></section>}
    {notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    <section className="business-section"><div className="section-heading"><span>RECENT MOVEMENTS</span></div>{movements.length ? <ul className="activity-list">{movements.map((movement) => <li key={movement.id}><span>{movementNames[movement.product_id] ?? "Product"}</span><span>{movement.note || movement.movement_type}</span><strong>{movement.quantity_delta > 0 ? "+" : ""}{movement.quantity_delta}</strong></li>)}</ul> : <p className="business-muted">No stock movements yet.</p>}</section>
  </div>;
}
