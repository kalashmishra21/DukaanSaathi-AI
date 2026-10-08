import Link from "next/link";
import type { ShopContext } from "@/server/data/context";
import { CreateDemoShop } from "./create-demo-shop";

export function ConnectionState({ kind }: { kind: Exclude<ShopContext["kind"], "ready" | "signed-out"> }) {
  if (kind === "no-shop") return (
    <section className="business-empty" aria-labelledby="no-shop-title">
      <p className="workspace-eyebrow">FIRST STEP / YOUR SHOP</p>
      <h1 id="no-shop-title">Make this workspace yours.</h1>
      <p>Create a private demo shop with synthetic products, customers, ledger entries and a sale. The seed is repeatable and belongs only to your account.</p>
      <CreateDemoShop />
    </section>
  );
  if (kind === "unavailable") return (
    <section className="business-empty" role="alert"><p className="workspace-eyebrow">CONNECTION</p><h1>Store data is unavailable.</h1><p>Check the Supabase project and try again. Nothing was changed.</p></section>
  );
  return (
    <section className="business-empty" aria-labelledby="setup-title">
      <p className="workspace-eyebrow">SUPABASE SETUP</p>
      <h1 id="setup-title">Ready for a real store.</h1>
      <p>Connect a Supabase project to enable sign-in and authoritative inventory, khata and sales data. The landing experience and mock AI preview remain available without credentials.</p>
      <Link className="button button-dark" href="/signin">View sign-in setup</Link>
    </section>
  );
}
