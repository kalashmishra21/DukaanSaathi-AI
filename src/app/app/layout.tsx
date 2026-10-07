import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, AudioLines } from "lucide-react";
import { WorkspaceNav } from "@/components/layout/workspace-nav";

export const metadata: Metadata = { title: "Workspace | DukaanSaathi AI" };

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand" aria-label="DukaanSaathi AI home"><span className="brand-mark" aria-hidden="true"><span /></span><span>DukaanSaathi <small>AI</small></span></Link>
        <div className="workspace-nav-label">WORKSPACE</div>
        <WorkspaceNav />
        <div className="workspace-sidebar-bottom"><span className="workspace-voice-glyph"><AudioLines size={22} strokeWidth={1.5} aria-hidden="true" /></span><strong>Saathi is ready</strong><p>Mock mode is active. Every action is a preview.</p></div>
      </aside>
      <div className="workspace-content">
        <header className="workspace-topbar"><div><span className="workspace-topbar-mark" /><span>DEMO WORKSPACE</span><span className="workspace-topbar-separator">/</span><span className="workspace-topbar-secondary">NO STORE CONNECTED</span></div><Link href="/">View website <ArrowUpRight size={16} aria-hidden="true" /></Link></header>
        <main className="workspace-main">{children}</main>
      </div>
    </div>
  );
}
