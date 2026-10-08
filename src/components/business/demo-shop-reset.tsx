"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DemoShopReset() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function reset() {
    if (confirmation !== "RESET" || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/business", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "shop.reset" }),
      });
      if (!response.ok) throw new Error("Demo shop could not be reset. No change was confirmed.");
      setNotice("Demo shop restored with fresh sample records.");
      setOpen(false);
      setConfirmation("");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Demo shop could not be reset.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="demo-reset" aria-label="Demo shop controls">
    <div><strong>DEMO DATA</strong><p>This private shop contains synthetic records for testing. Reset removes its current products, sales and ledgers, then seeds fresh samples.</p></div>
    {!open ? <button type="button" className="text-button" onClick={() => { setNotice(""); setOpen(true); }}>Reset demo shop</button> :
      <div className="demo-reset-confirm"><label htmlFor="demo-reset-confirmation">Type RESET to replace this shop&apos;s records</label>
        <input id="demo-reset-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
        <button type="button" className="button button-copper" onClick={() => void reset()} disabled={busy || confirmation !== "RESET"}>{busy ? "Restoring…" : "Restore demo data"}</button>
        <button type="button" className="text-button" onClick={() => { setOpen(false); setConfirmation(""); setError(""); }} disabled={busy}>Cancel</button>
      </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-notice" role="status">{notice}</p>}
  </section>;
}
