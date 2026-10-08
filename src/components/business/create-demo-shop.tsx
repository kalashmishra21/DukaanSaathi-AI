"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateDemoShop() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/business", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "shop.seed" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create the demo shop.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the demo shop.");
    } finally { setBusy(false); }
  }
  return <div><button className="button button-copper" type="button" onClick={() => void create()} disabled={busy}>{busy ? "Creating your shop…" : "Create demo shop"}</button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
