import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="site-header landing-header">
      <Link className="brand" href="/" aria-label="DukaanSaathi AI, home">
        <span className="brand-mark" aria-hidden="true"><span /></span>
        <span>DukaanSaathi <span className="brand-ai">AI</span></span>
      </Link>
      <nav className="landing-nav" aria-label="Landing navigation">
        <a href="#possibilities">Capabilities</a>
        <a href="#voice-demo">Voice demo</a>
      </nav>
      <Link className="header-link" href="/app/assistant">Open workspace <ArrowUpRight size={17} strokeWidth={1.8} aria-hidden="true" /></Link>
    </header>
  );
}
