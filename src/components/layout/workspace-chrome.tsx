"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AudioLines, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { BrandLockup, BrandMark } from "./brand";
import { WorkspaceNav } from "./workspace-nav";
import { ProfileControl } from "./profile-control";

export function WorkspaceChrome({ children, shopName, status, description, demo }: {
  children: ReactNode; shopName: string; status: string; description: string; demo: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const mobile = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setCollapsed(localStorage.getItem("dukaansaathi-sidebar") === "collapsed"); } catch { /* Default expanded. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.dataset.sidebar = next ? "collapsed" : "expanded";
    try { localStorage.setItem("dukaansaathi-sidebar", next ? "collapsed" : "expanded"); } catch { /* This session still updates. */ }
  }

  const sidebar = (mobileView: boolean) => <>
    <div className="workspace-sidebar-head"><BrandLockup href="/app" className="workspace-brand" />
      {mobileView ? <button type="button" className="sidebar-icon-button" aria-label="Close navigation" onClick={() => mobile.current?.close()}><X size={19} /></button>
        : <button type="button" className="sidebar-icon-button sidebar-collapse" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={toggleSidebar}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>}
    </div>
    <WorkspaceNav onNavigate={mobileView ? () => mobile.current?.close() : undefined} />
    <div className="workspace-sidebar-bottom"><span className="workspace-voice-glyph"><AudioLines size={20} strokeWidth={1.5} aria-hidden="true" /></span><div><strong>{status}</strong><p>{description}</p></div></div>
  </>;

  return <div className="workspace-shell">
    <aside className="workspace-sidebar" aria-label="Workspace sidebar">{sidebar(false)}</aside>
    <div className="workspace-content">
      <header className="workspace-topbar">
        <div className="workspace-topbar-location"><button type="button" className="mobile-menu-button" aria-label="Open navigation" onClick={() => mobile.current?.showModal()}><Menu size={21} /></button><span className="workspace-mobile-symbol"><BrandMark size={26} /></span><span className="workspace-topbar-mark" /><span className="workspace-topbar-shop">{shopName}</span><span className="workspace-topbar-separator">/</span><span className="workspace-topbar-secondary">{demo ? "DEMO STORE" : "STORE WORKSPACE"}</span></div>
        <ProfileControl />
      </header>
      <main className="workspace-main">{children}</main>
    </div>
    <dialog ref={mobile} className="mobile-nav-dialog" aria-label="Workspace navigation" onClick={(event) => { if (event.target === mobile.current) mobile.current.close(); }}>
      <div className="mobile-nav-content">{sidebar(true)}</div>
    </dialog>
  </div>;
}
