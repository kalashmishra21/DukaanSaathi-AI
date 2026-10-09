import Link from "next/link";

export function BrandMark({ size = 34 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className="saathi-brand-symbol">
    <path d="M24 3.5 42.5 14v20L24 44.5 5.5 34V14L24 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M17 14v20M17 14h7.1c6.9 0 11.9 4.1 11.9 10s-5 10-11.9 10H17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M22 19v10M26 16.5v15M30 20v8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity=".9" />
  </svg>;
}

export function BrandLockup({ href = "/", className = "brand" }: { href?: string; className?: string }) {
  return <Link href={href} className={`${className} saathi-brand`} aria-label="DukaanSaathi AI">
    <BrandMark /><span className="saathi-wordmark">DukaanSaathi <small>AI</small></span>
  </Link>;
}
