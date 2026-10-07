import { ArrowDown, AudioLines, Boxes, ChartNoAxesCombined, NotebookText, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { StatusPill } from "@/components/ui/status-pill";

const capabilities = [
  { number: "01", title: "Inventory", description: "Understand stock through the words you already use.", icon: Boxes },
  { number: "02", title: "Khata", description: "Bring customer balances into the conversation.", icon: NotebookText },
  { number: "03", title: "Sales", description: "Make daily performance easier to ask about.", icon: ChartNoAxesCombined },
];

export default function Home() {
  return (
    <div id="top" className="page-shell">
      <div className="page-frame">
        <SiteHeader />
        <main>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" />Built for the rhythm of Indian retail</div>
              <h1 id="hero-title">Your store,<br /><em>understood by voice.</em></h1>
              <p className="hero-description">DukaanSaathi AI is a voice-first copilot designed to help Indian retailers manage inventory, khata, and sales in natural conversation.</p>
              <a className="text-link" href="#focus">See what we&apos;re building <ArrowDown size={18} aria-hidden="true" /></a>
            </div>

            <div className="preview" aria-label="Illustration of a future voice request moving through validation">
              <div className="preview-topline">
                <span>SAATHI / FOUNDATION</span>
                <span className="preview-indicator"><span /> READY TO BUILD</span>
              </div>
              <div className="voice-symbol" aria-hidden="true"><AudioLines size={49} strokeWidth={1.25} /></div>
              <p className="preview-label">A natural request</p>
              <p className="preview-quote">“Maggi ke 20 packet add kar do”</p>
              <div className="preview-divider" />
              <div className="preview-result">
                <span className="preview-result-icon"><ShieldCheck size={20} strokeWidth={1.7} aria-hidden="true" /></span>
                <div><span>Structured intent</span><strong>inventory.adjust <span>·</span> +20 Maggi</strong></div>
              </div>
              <p className="preview-note">Illustrative mock output. No stock changes are made in Phase 1.</p>
            </div>
          </section>

          <section id="focus" className="focus-section" aria-labelledby="focus-title">
            <div className="section-heading">
              <div><p className="section-kicker">THE WORK AHEAD</p><h2 id="focus-title">One conversation. Clearer commerce.</h2></div>
              <p>Designed around the everyday decisions behind a neighborhood store.</p>
            </div>
            <div className="capability-grid">
              {capabilities.map(({ number, title, description, icon: Icon }) => (
                <article className="capability" key={title}>
                  <div className="capability-top"><span>{number} / 03</span><Icon size={23} strokeWidth={1.5} aria-hidden="true" /></div>
                  <h3>{title}</h3><p>{description}</p>
                </article>
              ))}
            </div>
          </section>
        </main>
        <footer className="site-footer">
          <span>Built with care for the stores that keep India moving.</span>
          <StatusPill><span className="pill-dot" /> Mock AI mode — no Gnani credits used</StatusPill>
        </footer>
      </div>
    </div>
  );
}
