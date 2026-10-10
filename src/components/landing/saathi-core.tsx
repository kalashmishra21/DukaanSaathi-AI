"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

export type CoreMode = "idle" | "listening" | "thinking" | "action" | "result";
const CoreScene = dynamic(() => import("./core-scene"), { ssr: false });
const sequence: CoreMode[] = ["idle", "listening", "thinking", "action", "result"];
const durations = [650, 1500, 1800, 1650, 1400];
const states: Record<CoreMode, { title: string; detail: string; visual: string }> = {
  idle: { title: "Ready for a request", detail: "An illustrative command is queued. Your microphone is off.", visual: "Faceted Saathi Core at rest" },
  listening: { title: "Voice, illustrated", detail: "The waveform is simulated; no microphone is recording.", visual: "Faceted Saathi Core in simulated listening state" },
  thinking: { title: "Meaning identified", detail: "Product: Maggi · quantity: 20 packets.", visual: "Faceted Saathi Core in simulated reasoning state" },
  action: { title: "Validated action preview", detail: "Proposed stock adjustment: +20 Maggi packets. Nothing has been saved.", visual: "Faceted Saathi Core in simulated validation state" },
  result: { title: "Simulated stock result", detail: "Illustrative outcome: +20 packets. No store record changed.", visual: "Faceted Saathi Core in simulated result state" },
};

function CoreFallback({ description }: { description: string }) {
  return <div className="core-object" role="img" aria-label={description}>
    <svg viewBox="0 0 480 480" aria-hidden="true" focusable="false">
      <defs><linearGradient id="landing-core-face" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stopColor="#f7d9ac" /><stop offset=".45" stopColor="#b87749" /><stop offset="1" stopColor="#5e4432" /></linearGradient></defs>
      <path className="core-shadow" d="M240 52 363 103 424 226 382 349 263 427 130 395 54 286 75 157 169 68Z" />
      <path className="facet facet-back" d="M240 52 363 103 424 226 382 349 263 427 130 395 54 286 75 157 169 68Z" />
      <path className="facet facet-a" d="M240 52 363 103 296 170 240 210 169 68Z" />
      <path className="facet facet-b" d="M363 103 424 226 345 250 296 170Z" />
      <path className="facet facet-c" d="M424 226 382 349 286 315 345 250Z" />
      <path className="facet facet-d" d="M382 349 263 427 240 352 286 315Z" />
      <path className="facet facet-e" d="M263 427 130 395 168 309 240 352Z" />
      <path className="facet facet-f" d="M130 395 54 286 136 242 168 309Z" />
      <path className="facet facet-g" d="M54 286 75 157 143 182 136 242Z" />
      <path className="facet facet-h" d="M75 157 169 68 240 210 143 182Z" />
      <path className="facet facet-center" d="M240 210 296 170 345 250 286 315 240 352 168 309 136 242 143 182Z" />
      <path className="facet-aperture" d="M240 210 296 170 345 250 286 315Z" /><circle className="facet-aperture-rim" cx="284" cy="246" r="27" /><circle className="facet-aperture-eye" cx="284" cy="246" r="11" />
      <path className="facet-line" d="M240 52 240 210M363 103 296 170M424 226 345 250M382 349 286 315M263 427 240 352M130 395 168 309M54 286 136 242M75 157 143 182M169 68 143 182M240 210 345 250M240 210 168 309M240 352 240 210" />
      <path className="facet-rim" d="M240 52 363 103 424 226 382 349 263 427 130 395 54 286 75 157 169 68Z" />
    </svg>
  </div>;
}

function LiquidLens() {
  const lens = useRef<{ destroy?: () => void } | null>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 901px) and (prefers-reduced-motion: no-preference) and (prefers-reduced-transparency: no-preference)");
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const lowPower = (memory && memory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    if (!media.matches || lowPower) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (document.hidden || cancelled) return;
      try {
        const { default: liquidGL } = await import("liquid-gl");
        if (cancelled) return;
        lens.current = liquidGL({ target: ".stage12-landing .glass-refraction", snapshot: "body", engine: "webgl2", resolution: 0.65, refraction: 0.009, bevelWidth: 0.12, bevelDepth: 0.06, frost: 0.02, shadow: false, specular: true, tint: "rgba(20, 40, 29, 0.11)", interaction: "none", reveal: "none" });
      } catch { /* Opaque CSS surface remains readable. */ }
    }, 4200);
    return () => { cancelled = true; window.clearTimeout(timer); lens.current?.destroy?.(); lens.current = null; };
  }, []);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY < window.innerHeight * 0.65);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <div className="glass-floating" data-out={!visible} aria-hidden="true"><div className="glass-refraction" /><div className="glass-content"><span>SAATHI / INTENT LENS</span><strong>Signal becomes meaning.</strong><small>Illustrative visual</small></div></div>;
}

export function SaathiCore() {
  const [mode, setMode] = useState<CoreMode>("idle");
  const [canRender, setCanRender] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [inView, setInView] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const orbit = useRef<HTMLDivElement>(null);
  const index = useRef(0);
  const onSceneReady = useCallback(() => setRendered(true), []);
  const onSceneLost = useCallback(() => { setRendered(false); setCanRender(false); }, []);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 650px)");
    const update = () => {
      const reduced = preference.matches;
      setReducedMotion(reduced);
      if (reduced) { index.current = 0; setMode("idle"); }
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      const lowPower = (memory && memory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
      let webgl = false;
      if (!reduced && !mobile.matches && !lowPower) {
        try {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
          webgl = Boolean(context);
          context?.getExtension("WEBGL_lose_context")?.loseContext();
        } catch { webgl = false; }
      }
      setCanRender(webgl);
      if (!webgl) setRendered(false);
    };
    update();
    preference.addEventListener("change", update); mobile.addEventListener("change", update);
    return () => { preference.removeEventListener("change", update); mobile.removeEventListener("change", update); };
  }, []);
  useEffect(() => {
    if (reducedMotion) return;
    if (!inView) return;
    let timer: number;
    const advance = () => { timer = window.setTimeout(() => { index.current = (index.current + 1) % sequence.length; setMode(sequence[index.current]); advance(); }, durations[index.current]); };
    advance();
    return () => window.clearTimeout(timer);
  }, [inView, reducedMotion]);
  useEffect(() => {
    if (!orbit.current) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.04 });
    observer.observe(orbit.current);
    return () => observer.disconnect();
  }, []);
  const state = states[mode];
  return <div className="core-column">
    <LiquidLens />
    <div className="core-display" data-state={mode} data-renderer={rendered ? "webgl" : "fallback"}>
      <div className="core-topline"><span>Saathi Core</span><span>VOICE / INTENT / VERIFIED PREVIEW</span></div>
      <div className="core-orbit" ref={orbit}>
        <div className="orbit orbit-outer" /><div className="orbit orbit-inner" />
        <span className="orbit-node node-stock">Stock</span><span className="orbit-node node-khata">Khata</span><span className="orbit-node node-sales">Sales</span><div className="core-halo" />
        <CoreFallback description={state.visual} />
        {canRender && <div className="core-canvas"><CoreScene mode={mode} onReady={onSceneReady} onContextLost={onSceneLost} /></div>}
        <div className="voice-bars" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div>
      </div>
      <div className="core-readout">
        <div className="demo-command"><span>SIMULATED MERCHANT COMMAND</span><strong>“Maggi ke 20 packet add karo”</strong></div>
        <div className="core-demo-response"><div className="demo-status"><span className="readout-dot" aria-hidden="true" /><strong>{state.title}</strong></div><p>{state.detail}</p><div className="demo-chips" aria-hidden="true"><span data-chip="product">Product <b>Maggi</b></span><span data-chip="quantity">Quantity <b>20 packets</b></span><span data-chip="action">Preview <b>+20 stock</b></span></div></div>
      </div>
    </div>
    <div className="core-sequence" aria-label="Illustrative sequence: voice, understanding, validated preview, simulated result"><div className="sequence-track" aria-hidden="true">{Array.from({ length: 4 }, (_, i) => <i key={i} />)}</div><span>Voice</span><span>Understand</span><span>Preview</span><span>Illustrate</span></div>
  </div>;
}
