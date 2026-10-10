"use client";

import { useEffect, useRef } from "react";

export function LiquidHeaderEnhancement() {
  const liquid = useRef<{ destroy?: () => void } | null>(null);

  useEffect(() => {
    const supported = window.matchMedia("(min-width: 901px) and (prefers-reduced-motion: no-preference) and (prefers-reduced-transparency: no-preference)");
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const network = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!supported.matches || network?.saveData || (memory && memory <= 4) || navigator.hardwareConcurrency <= 4) return;
    let cancelled = false;
    let timer: number | undefined;
    let idleId: number | undefined;
    const init = () => {
      if (document.hidden || cancelled) return;
      void import("liquid-gl").then(({ default: liquidGL }) => {
        if (cancelled) return;
        liquid.current = liquidGL({
          target: ".stage12-landing .liquid-header",
          snapshot: "body",
          engine: "webgl2",
          resolution: 0.75,
          refraction: 0.012,
          bevelWidth: 0.11,
          bevelDepth: 0.055,
          frost: 0.01,
          shadow: false,
          specular: true,
          tint: "rgba(117, 157, 125, 0.06)",
          interaction: "none",
          reveal: "none",
        });
      }).catch(() => { /* The CSS glass remains the complete fallback. */ });
    };
    const schedule = () => {
      const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
      if (idleWindow.requestIdleCallback) idleId = idleWindow.requestIdleCallback(init, { timeout: 2600 });
      else timer = window.setTimeout(init, 1600);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (timer !== undefined) window.clearTimeout(timer);
      const idleWindow = window as Window & { cancelIdleCallback?: (id: number) => void };
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId);
      liquid.current?.destroy?.();
      liquid.current = null;
    };
  }, []);

  return null;
}
