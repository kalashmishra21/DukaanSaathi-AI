"use client";

import { useState } from "react";
import { AudioLines, Check, CornerDownRight } from "lucide-react";

const samples = [
  { phrase: "Maggi ke 20 packet add kar do.", intent: "inventory.adjust", detail: "Maggi · +20 packets", note: "Structured preview. Stock is not updated." },
  { phrase: "Sharma ji ka kitna udhaar hai?", intent: "khata.getBalance", detail: "Customer · Sharma ji", note: "A connected ledger is needed for a real balance." },
  { phrase: "Aaj ki total sale batao.", intent: "future sales request", detail: "Daily sales summary", note: "This scenario is planned; no sales data is connected." },
  { phrase: "Low-stock items ki reorder list bana do.", intent: "future inventory request", detail: "Reorder suggestions", note: "This scenario is planned; no stock data is connected." },
];

export function LandingVoiceDemo() {
  const [selected, setSelected] = useState(0);
  const sample = samples[selected];

  return (
    <div className="demo-console">
      <div className="demo-console-header"><span><AudioLines size={16} aria-hidden="true" /> SAATHI / VOICE PREVIEW</span><span className="demo-console-signal"><span /> MOCK MODE</span></div>
      <div className="demo-console-body">
        <p className="demo-small-label">SELECT A SAMPLE REQUEST</p>
        <div className="demo-requests">{samples.map((item, index) => <button key={item.phrase} type="button" className={selected === index ? "selected" : ""} aria-pressed={selected === index} onClick={() => setSelected(index)}><span>{item.phrase}</span><CornerDownRight size={16} aria-hidden="true" /></button>)}</div>
        <div className="demo-response" aria-live="polite"><span className="demo-response-kicker"><Check size={15} aria-hidden="true" /> STRUCTURED UNDERSTANDING</span><strong>{sample.intent}</strong><span>{sample.detail}</span><p>{sample.note}</p></div>
      </div>
      <div className="demo-console-footer">DETERMINISTIC DEMO · NO DATA CHANGED</div>
    </div>
  );
}
