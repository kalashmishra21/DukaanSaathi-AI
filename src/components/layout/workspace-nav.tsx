"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartNoAxesCombined, House, MessageCircleMore, Package, ReceiptText, ScrollText, Truck } from "lucide-react";

const items = [
  { href: "/app", label: "Overview", icon: House },
  { href: "/app/assistant", label: "Assistant", icon: MessageCircleMore },
  { href: "/app/inventory", label: "Inventory", icon: Package },
  { href: "/app/khata", label: "Khata", icon: ScrollText },
  { href: "/app/sales", label: "Sales", icon: ChartNoAxesCombined },
  { href: "/app/suppliers", label: "Suppliers", icon: Truck },
  { href: "/app/orders", label: "Orders", icon: ReceiptText },
];

export function WorkspaceNav() {
  const pathname = usePathname();
  return (
    <nav className="workspace-nav" aria-label="Workspace navigation">
      {items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} prefetch={true} aria-current={pathname === href ? "page" : undefined}><Icon size={18} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span></Link>)}
    </nav>
  );
}
