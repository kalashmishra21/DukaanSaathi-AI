import { ArrowUpRight } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="DukaanSaathi AI, back to top">
        <span className="brand-mark" aria-hidden="true"><span /></span>
        <span>DukaanSaathi <span className="brand-ai">AI</span></span>
      </a>
      <a className="header-link" href="#focus">
        Explore the foundation <ArrowUpRight size={17} strokeWidth={1.8} aria-hidden="true" />
      </a>
    </header>
  );
}
