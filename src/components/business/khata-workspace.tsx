"use client";

import { useState, type FormEvent } from "react";
import { rupees } from "@/lib/business/calculations";
import type { Customer, KhataEntry } from "@/lib/business/schemas";
import { useBusinessMutation } from "./use-business-mutation";

export function KhataWorkspace({ customers, entries, balances }: { customers: Customer[]; entries: KhataEntry[]; balances: Record<string, number> }) {
  const [selectedId, setSelectedId] = useState<string | null>(customers[0]?.id ?? null);
  const selected = customers.find((customer) => customer.id === selectedId) ?? null;
  const { busy, error, notice, run } = useBusinessMutation();

  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const result = await run({ kind: "customer.create", name: String(values.get("name") || "").trim(), phone: String(values.get("phone") || "").trim() || undefined }, "Customer added.");
    if (result) { setSelectedId(String(result.id)); form.reset(); }
  }

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    if (await run({ kind: "khata.add", customerId: selected.id, type: String(values.get("type")) as "gave" | "received", amount: Number(values.get("amount")), note: String(values.get("note") || "") }, "Ledger entry saved.")) form.reset();
  }

  return <div className="business-page">
    <div className="workspace-page-heading"><p className="workspace-eyebrow">KHATA / CONNECTED</p><h1>Every balance<br /><em>in context.</em></h1><p>Positive outstanding means the customer owes the shop. “Gave” adds to the balance; “Received” reduces it.</p></div>
    <div className="khata-layout">
      <section className="business-section"><div className="section-heading"><span>CUSTOMERS / {customers.length}</span></div>
        <div className="customer-list">{customers.length ? customers.map((customer) => <button className={selected?.id === customer.id ? "customer-row selected" : "customer-row"} type="button" key={customer.id} onClick={() => setSelectedId(customer.id)} aria-pressed={selected?.id === customer.id}><span><strong>{customer.name}</strong><small>{customer.phone || "No phone saved"}</small></span><span>{rupees(balances[customer.id] ?? 0)}</span></button>) : <p className="business-muted">No customers yet.</p>}</div>
        <div className="business-form-panel inset-form"><div className="section-heading"><span>ADD CUSTOMER</span></div><form className="business-form" onSubmit={(event) => void addCustomer(event)}><label>Name<input name="name" required maxLength={120} placeholder="Customer name" /></label><label>Phone (optional)<input name="phone" type="tel" maxLength={20} placeholder="Leave blank for demo" /></label><button className="button button-dark" disabled={busy} type="submit">Add customer</button></form></div>
      </section>
      <section className="business-section"><div className="section-heading"><span>CUSTOMER ACCOUNT</span><span>LEDGER / INR</span></div>
        {selected ? <><div className="ledger-balance"><span>{selected.name.toUpperCase()} / OUTSTANDING</span><strong>{rupees(balances[selected.id] ?? 0)}</strong><p>{(balances[selected.id] ?? 0) < 0 ? "The shop owes this customer." : "The customer owes the shop."}</p></div>
          <form key={selected.id} className="business-form ledger-form" onSubmit={(event) => void addEntry(event)}><div className="form-grid"><label>Entry type<select name="type" defaultValue="gave"><option value="gave">Gave — increases owed</option><option value="received">Received — reduces owed</option></select></label><label>Amount ₹<input name="amount" type="number" min="0.01" step="0.01" required /></label></div><label>Note<input name="note" maxLength={300} placeholder="What was this for?" /></label><button className="button button-copper" type="submit" disabled={busy}>Save entry</button></form>
          <div className="section-heading ledger-history-heading"><span>ENTRY HISTORY</span></div>{entries.filter((entry) => entry.customer_id === selected.id).length ? <ul className="activity-list">{entries.filter((entry) => entry.customer_id === selected.id).map((entry) => <li key={entry.id}><span>{entry.type === "gave" ? "Gave" : "Received"}</span><span>{entry.note || new Date(entry.created_at).toLocaleDateString("en-IN")}</span><strong>{entry.type === "gave" ? "+" : "−"}{rupees(entry.amount)}</strong></li>)}</ul> : <p className="business-muted">No entries yet.</p>}</> : <p className="business-muted">Choose a customer or add one to start the ledger.</p>}
      </section>
    </div>
    {notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
