import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, ChartNoAxesCombined, PackagePlus, ScrollText } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SaathiCore } from "@/components/landing/saathi-core";
import { LandingVoiceDemo } from "@/components/landing/voice-demo";

const capabilities = [
  { number: "01", title: "Inventory in plain language", detail: "Describe a stock change as naturally as you would to a colleague. Saathi prepares the right structured action.", icon: PackagePlus },
  { number: "02", title: "Khata with context", detail: "Ask about a customer by name, then see a clear result once a trusted ledger is connected.", icon: ScrollText },
  { number: "03", title: "A clearer sales picture", detail: "Turn a question about the day into a useful summary, without digging through menus.", icon: ChartNoAxesCombined },
];

const steps = [
  { number: "01", title: "Speak", detail: "Start with your own words." },
  { number: "02", title: "Understand", detail: "AI prepares a structured intent." },
  { number: "03", title: "Act", detail: "A trusted server tool validates the request." },
  { number: "04", title: "Confirm", detail: "Only real tool results become confirmations." },
];

export default function Home() {
  return (
    <div id="top" className="landing-page">
      <div className="landing-frame"><SiteHeader /></div>
      <main>
        <section className="landing-hero landing-frame" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow"><span /> A new language for commerce</p>
            <h1 id="landing-title">Your store,<br /><em>understood</em><br />by voice.</h1>
            <p className="landing-hero-description">A multilingual AI copilot for Indian retailers to manage inventory, khata and sales through natural conversation.</p>
            <div className="landing-hero-actions">
              <Link className="button button-copper" href="/app/assistant">Explore the workspace <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <a className="landing-text-link" href="#voice-demo">See a voice example <ArrowDown size={17} aria-hidden="true" /></a>
            </div>
            <p className="landing-proof"><span /> Mock AI reasoning · no Gnani credits used</p>
          </div>
          <SaathiCore />
        </section>

        <div className="landing-rule landing-frame"><span>DESIGNED FOR THE WAY STORES ACTUALLY WORK</span><span>VOICE → CONTEXT → CLARITY</span></div>

        <section id="possibilities" className="landing-capabilities landing-frame" aria-labelledby="possibilities-title">
          <div className="landing-section-intro"><p className="landing-eyebrow">WHAT CAN DUKAANSAATHI DO?</p><h2 id="possibilities-title">Less navigation.<br /><em>More knowing.</em></h2><p>Built around everyday decisions at the counter, with the merchant in control of every action.</p></div>
          <div className="capability-list">
            {capabilities.map(({ number, title, detail, icon: Icon }) => <article key={number} className="capability-row"><span className="capability-number">{number}</span><span className="capability-icon"><Icon size={25} strokeWidth={1.45} aria-hidden="true" /></span><div><h3>{title}</h3><p>{detail}</p></div><ArrowUpRight size={19} strokeWidth={1.4} aria-hidden="true" /></article>)}
          </div>
        </section>

        <section id="voice-demo" className="landing-demo-section" aria-labelledby="demo-title">
          <div className="landing-frame landing-demo-grid">
            <div className="landing-demo-intro"><p className="landing-eyebrow">A CONVERSATION, NOT A FORM</p><h2 id="demo-title">Ask the way<br />you <em>think.</em></h2><p>Hinglish is welcome here. Try a sample phrase to see structured mock understanding. This landing preview does not change store data; the signed-in assistant can run trusted tools.</p><Link className="landing-text-link dark" href="/app/assistant">Try the mock assistant <ArrowRight size={18} aria-hidden="true" /></Link></div>
            <LandingVoiceDemo />
          </div>
        </section>

        <section className="landing-workflow landing-frame" aria-labelledby="workflow-title"><div className="workflow-heading"><p className="landing-eyebrow">THE TRUSTED PATH</p><h2 id="workflow-title">From a word to a<br /><em>verified outcome.</em></h2><p>The model proposes. The server checks. The store stays in control.</p></div><div className="workflow-grid">{steps.map((step) => <div className="workflow-step" key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.detail}</p></div>)}</div></section>

        <section className="landing-final"><div className="landing-frame landing-final-inner"><div><p className="landing-eyebrow">BUILT FOR THE NEXT SHIFT</p><h2>A better store day<br />starts with <em>a sentence.</em></h2></div><div><p>Explore the workspace. Connect Supabase and sign in to work with real store records. No paid AI service is required.</p><Link className="button button-dark" href="/app/assistant">Enter DukaanSaathi <ArrowUpRight size={18} aria-hidden="true" /></Link></div></div></section>
      </main>
      <footer className="landing-footer landing-frame"><Link className="footer-brand" href="/">DukaanSaathi AI</Link><span>Built for the stores that keep India moving.</span><span>MOCK AI / TRUSTED DATA</span></footer>
    </div>
  );
}
