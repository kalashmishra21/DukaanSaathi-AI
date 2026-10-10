import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandLockup } from "./brand";
import { LiquidHeaderEnhancement } from "./liquid-header-enhancement";

export function SiteHeader() {
  return (
    <header className="site-header landing-header liquid-header">
      <LiquidHeaderEnhancement />
      <div className="liquid-header-content">
        <BrandLockup />
        <nav className="landing-nav" aria-label="Landing navigation">
          <a href="#story">How it works</a>
          <a href="#voice-demo">Voice demo</a>
        </nav>
        <div className="landing-account-actions"><Link href="/signin">Login</Link><Link className="header-link" href="/signin?mode=signup">Sign Up <ArrowUpRight size={17} strokeWidth={1.8} aria-hidden="true" /></Link></div>
      </div>
    </header>
  );
}
