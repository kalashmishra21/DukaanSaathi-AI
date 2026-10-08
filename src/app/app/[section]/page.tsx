import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";

const sections = {
  orders: { title: "Orders", phrase: "A clear path from need to reorder.", detail: "Order planning and fulfillment are reserved for a later phase. No order can be placed from this preview.", example: "Low-stock items ki reorder list bana do." },
} as const;

export function generateStaticParams() { return Object.keys(sections).map((section) => ({ section })); }

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(section in sections)) notFound();
  const current = sections[section as keyof typeof sections];
  return <div className="module-page"><div className="workspace-page-heading"><p className="workspace-eyebrow">{current.title.toUpperCase()} / PREVIEW</p><h1>{current.phrase}</h1><p>{current.detail}</p></div><div className="module-preview"><div><span>MODULE PREVIEW</span><h2>The workspace is ready for the next layer.</h2><p>Try a related question in the mock assistant. Its response stays clearly marked as a preview.</p><Link className="button button-dark" href="/app/assistant">Open Assistant <ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className="module-quote"><span>EXAMPLE PHRASE</span><blockquote>“{current.example}”</blockquote><Link href="/app/assistant">Explore the mock flow <ArrowRight size={17} aria-hidden="true" /></Link></div></div></div>;
}
