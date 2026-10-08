"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import type { Supplier } from "@/lib/business/schemas";
import { useBusinessMutation } from "./use-business-mutation";

export function SuppliersWorkspace({ suppliers }: { suppliers: Supplier[] }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const { busy, error, notice, run } = useBusinessMutation();
  const visible = suppliers.filter((supplier) => `${supplier.name} ${supplier.contact_name ?? ""}`.toLocaleLowerCase("en-IN").includes(search.toLocaleLowerCase("en-IN")));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const contactName = String(data.get("contactName") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const action = editing
      ? { kind: "supplier.edit" as const, id: editing.id, name, contactName: contactName || null, phone: phone || null }
      : { kind: "supplier.create" as const, name, contactName: contactName || undefined, phone: phone || undefined };
    if (await run(action, editing ? "Supplier updated." : "Supplier added.")) { setEditing(null); form.reset(); }
  }

  return <div className="business-page">
    <div className="workspace-page-heading"><p className="workspace-eyebrow">SUPPLIERS / CONNECTED</p><h1>Know who<br /><em>keeps you stocked.</em></h1><p>A small, reliable directory for the people behind every reorder. Demo contacts are synthetic.</p></div>
    <div className="business-columns">
      <section className="business-section"><div className="section-heading"><span>SUPPLIER DIRECTORY / {suppliers.length}</span><Link href="/app/orders">Purchase orders <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        <label className="business-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search suppliers</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search suppliers" /></label>
        {visible.length ? <ul className="merchant-list">{visible.map((supplier) => <li key={supplier.id}><div><strong>{supplier.name}</strong><span>{supplier.contact_name || "No contact name"}{supplier.phone ? ` · ${supplier.phone}` : ""}</span></div><button className="text-button" type="button" onClick={() => setEditing(supplier)}>Edit</button></li>)}</ul>
          : <p className="business-muted">{search ? "No supplier matches this search." : "No suppliers yet. Add one to create a purchase order."}</p>}
      </section>
      <section className="business-section business-form-panel"><div className="section-heading"><span>{editing ? "EDIT SUPPLIER" : "ADD SUPPLIER"}</span>{editing && <button type="button" onClick={() => setEditing(null)}>Cancel</button>}</div>
        <form key={editing?.id ?? "new"} className="business-form" onSubmit={(event) => void save(event)}><label>Supplier name<input name="name" required maxLength={120} defaultValue={editing?.name} placeholder="e.g. North Market Distributors" /></label><label>Contact name (optional)<input name="contactName" maxLength={120} defaultValue={editing?.contact_name ?? ""} /></label><label>Phone (optional)<input name="phone" type="tel" minLength={6} maxLength={20} defaultValue={editing?.phone ?? ""} /></label><button className="button button-dark" type="submit" disabled={busy}><Plus size={16} aria-hidden="true" /> {editing ? "Save supplier" : "Add supplier"}</button></form>
      </section>
    </div>
    {notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
