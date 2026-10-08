import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, AudioLines } from "lucide-react";
import { WorkspaceNav } from "@/components/layout/workspace-nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { getShopContext } from "@/server/data/context";

export const metadata: Metadata = { title: "Workspace | DukaanSaathi AI" };

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getShopContext();
  if (context.kind === "signed-out") redirect("/signin");
  const connected = context.kind === "ready";
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand" aria-label="DukaanSaathi AI home"><span className="brand-mark" aria-hidden="true"><span /></span><span>DukaanSaathi <small>AI</small></span></Link>
        <div className="workspace-nav-label">WORKSPACE</div>
        <WorkspaceNav />
        <div className="workspace-sidebar-bottom"><span className="workspace-voice-glyph"><AudioLines size={22} strokeWidth={1.5} aria-hidden="true" /></span><strong>{connected ? "Store connected" : "Saathi is ready"}</strong><p>{connected ? "Business data is real. AI reasoning remains mocked." : "Connect a shop to enable trusted business actions."}</p></div>
      </aside>
      <div className="workspace-content">
        <header className="workspace-topbar"><div><span className="workspace-topbar-mark" /><span>{connected ? context.shop.name : "WORKSPACE SETUP"}</span><span className="workspace-topbar-separator">/</span><span className="workspace-topbar-secondary">{connected ? "REAL STORE DATA" : "NO STORE CONNECTED"}</span></div><div className="workspace-topbar-actions"><Link href="/">View website <ArrowUpRight size={16} aria-hidden="true" /></Link>{(connected || context.kind === "no-shop") && <SignOutButton />}</div></header>
        <main className="workspace-main">{children}</main>
      </div>
    </div>
  );
}
