"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

export type CoreMode = "idle" | "listening" | "thinking" | "action";

const CoreScene = dynamic(() => import("./core-scene"), { ssr: false });

const modes: { id: CoreMode; label: string; description: string }[] = [
  { id: "idle", label: "At rest", description: "Ready when you are" },
  { id: "listening", label: "Listening", description: "Holding space for your request" },
  { id: "thinking", label: "Thinking", description: "Connecting words to the right action" },
  { id: "action", label: "Action", description: "A verified step will appear here" },
];

export function SaathiCore() {
  const [mode, setMode] = useState<CoreMode>("idle");
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px), (prefers-reduced-motion: reduce)");
    const update = () => {
      const lowMemory = "deviceMemory" in navigator && Number(navigator.deviceMemory) <= 4;
      let webgl = false;
      try {
        const canvas = document.createElement("canvas");
        webgl = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
      } catch {
        webgl = false;
      }
      setCanRender(!media.matches && !lowMemory && webgl);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const currentMode = modes.find((item) => item.id === mode) ?? modes[0];

  return (
    <div className="core-panel" data-mode={mode}>
      <div className="core-panel-top"><span>THE SAATHI CORE</span><span>INTERACTIVE STUDY / 01</span></div>
      <div className="core-stage" role="img" aria-label={`Saathi Core visual state: ${currentMode.label}. ${currentMode.description}.`}>
        <div className="core-fallback" aria-hidden="true">
          <div className="core-fallback-orbit orbit-one" />
          <div className="core-fallback-orbit orbit-two" />
          <div className="core-fallback-body"><span /></div>
        </div>
        {canRender && <div className="core-canvas"> <CoreScene mode={mode} /> </div>}
        <span className="core-concept concept-inventory">Inventory</span>
        <span className="core-concept concept-khata">Khata</span>
        <span className="core-concept concept-sales">Sales</span>
        <span className="core-concept concept-rupee">₹</span>
      </div>
      <div className="core-panel-bottom">
        <div><span className="core-status-line"><span className="core-status-dot" /> {currentMode.label}</span><p>{currentMode.description}</p></div>
        <div className="core-mode-list" aria-label="Preview Saathi Core states">
          {modes.map((item) => <button key={item.id} type="button" className={mode === item.id ? "active" : ""} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>{item.label}</button>)}
        </div>
      </div>
    </div>
  );
}
