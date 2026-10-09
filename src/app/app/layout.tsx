import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { BrandLockup } from "@/components/layout/brand";
import { getShopContext } from "@/server/data/context";
import { readProviderConfig } from "@/lib/env/config";

export const metadata: Metadata = { title: "Workspace | DukaanSaathi AI" };

function WorkspaceLoadingShell() {
  return <div className="workspace-shell" aria-busy="true">
    <aside className="workspace-sidebar">
      <BrandLockup href="/app" className="workspace-brand" />
    </aside>
    <div className="workspace-content"><header className="workspace-topbar"><div><span className="workspace-topbar-mark" /><span>OPENING WORKSPACE</span></div></header>
      <main className="workspace-main"><div className="workspace-page-loading" role="status"><span className="workspace-loading-line" /><strong>Opening your store…</strong><p>Checking your session and shop records.</p></div></main>
    </div>
  </div>;
}

async function WorkspaceLayoutData({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getShopContext();
  if (context.kind === "signed-out") redirect("/signin");
  const connected = context.kind === "ready";
  const demo = connected && context.shop.name === "DukaanSaathi Demo Mart";
  const realReasoning = readProviderConfig().AI_REASONER === "openrouter";
  return (
    <WorkspaceChrome shopName={connected ? context.shop.name : "Workspace setup"} demo={demo}
      status={demo ? "Demo shop connected" : connected ? "Store connected" : "Saathi is ready"}
      description={connected ? realReasoning ? "Store data is live. Demo phrases are deterministic; others use OpenRouter." : "Store data is live. Reasoning uses the mock provider." : "Connect a shop to enable trusted business actions."}>
      {children}
    </WorkspaceChrome>
  );
}

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Suspense fallback={<WorkspaceLoadingShell />}><WorkspaceLayoutData>{children}</WorkspaceLayoutData></Suspense>;
}
