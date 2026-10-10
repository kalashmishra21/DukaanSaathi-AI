"use client";

import { useEffect, useRef, useState } from "react";

export function LandingStory() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!section.current) return;
      const rect = section.current.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (innerHeight - rect.top) / (rect.height + innerHeight)));
      if (track.current) track.current.style.transform = `scaleX(${progress})`;
      const next = Math.min(2, Math.floor(progress * 3));
      setCurrent((value) => value === next ? value : next);
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    update();
    return () => { window.removeEventListener("scroll", queue); window.removeEventListener("resize", queue); cancelAnimationFrame(frame); };
  }, []);
  return <section className="story" id="story" ref={section} aria-labelledby="story-title">
    <div className="page-frame story-grid">
      <div className="story-heading"><p className="story-overline">A useful conversation has a shape.</p><h2 id="story-title">A request becomes<br /><em>a clear next step.</em></h2><p>Voice becomes structured intent. A trusted tool, not the model, decides what is saved.</p><div className="story-track" aria-hidden="true"><span ref={track} /></div><div className="story-phase-labels" aria-hidden="true"><span>VOICE</span><span>MEANING</span><span>VERIFY</span></div></div>
      <ol className="story-steps">
        <li className={`story-step ${current === 0 ? "is-current" : ""}`}><span className="step-index">01 / VOICE</span><div><h3>Say it your way.</h3><p>“Maggi ke 20 packet add karo.”</p><div className="story-visual story-wave" aria-hidden="true">{Array.from({ length: 17 }, (_, i) => <i key={i} />)}</div></div></li>
        <li className={`story-step ${current === 1 ? "is-current" : ""}`}><span className="step-index">02 / UNDERSTAND</span><div><h3>Meaning, made precise.</h3><p>One sentence becomes a proposal the merchant can inspect.</p><div className="story-visual story-extract"><span>PRODUCT <b>Maggi</b></span><span>QUANTITY <b>20 packets</b></span><span>INTENT <b>Adjust stock</b></span></div></div></li>
        <li className={`story-step ${current === 2 ? "is-current" : ""}`}><span className="step-index">03 / VERIFY</span><div><h3>Truth before a check.</h3><p>The trusted store tool validates and saves a real action. This preview changes nothing.</p><div className="story-visual story-verify"><span>Validated preview</span><strong>Maggi <b>+20</b></strong><small>SIMULATED RESULT · NO DATABASE CHANGE</small></div></div></li>
      </ol>
    </div>
  </section>;
}
