import Link from "next/link";
import { ArrowRight, ArrowUpRight, AudioLines, CircleCheck, DatabaseZap } from "lucide-react";

export default function Overview() {
  return (
    <div className="overview-page">
      <div className="workspace-page-heading"><p className="workspace-eyebrow">OVERVIEW / MOCK WORKSPACE</p><h1>A calmer way to run<br /><em>the day.</em></h1><p>This is a preview of your future store command center. No account, ledger, or live store data is connected yet.</p></div>
      <div className="overview-spotlight"><div className="overview-spotlight-copy"><span className="overview-spotlight-kicker"><AudioLines size={17} aria-hidden="true" /> START WITH A SENTENCE</span><h2>What needs your attention today?</h2><p>Ask Saathi in the words that come naturally. The Phase 2 assistant shows structured mock intent without changing any data.</p><Link className="button button-copper" href="/app/assistant">Open Assistant <ArrowUpRight size={17} aria-hidden="true" /></Link></div><div className="overview-orbit" aria-hidden="true"><div><span>stock</span><span>khata</span><span>sales</span></div></div></div>
      <div className="overview-lower"><section className="overview-readiness"><div className="overview-card-top"><span>FOUNDATION STATUS</span><CircleCheck size={19} aria-hidden="true" /></div><h3>Ready to explore</h3><p>The mock provider is available for two deterministic requests. Real tools and data arrive in later phases.</p><Link href="/app/assistant">Try a request <ArrowRight size={16} aria-hidden="true" /></Link></section><section className="overview-readiness pale"><div className="overview-card-top"><span>DATA CONNECTION</span><DatabaseZap size={19} aria-hidden="true" /></div><h3>Not connected</h3><p>Inventory, khata, sales, and orders are workspace previews. No business records are displayed or modified.</p><span className="overview-muted-action">SUPABASE PLANNED FOR LATER</span></section></div>
    </div>
  );
}
