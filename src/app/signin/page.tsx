import Link from "next/link";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { SignInForm } from "@/components/business/sign-in-form";

export default function SignInPage() {
  const configured = Boolean(getSupabaseConfig());
  return (
    <main className="auth-page">
      <div className="auth-top"><Link href="/" className="workspace-brand"><span className="brand-mark" aria-hidden="true"><span /></span><span>DukaanSaathi <small>AI</small></span></Link><span>SECURE SHOP ACCESS</span></div>
      <div className="auth-layout"><section className="auth-intro"><p className="workspace-eyebrow">YOUR STORE / ONE CLEAR PLACE</p><h1>Start with<br /><em>your shop.</em></h1><p>Sign in to work with real inventory, khata and sales records. AI interpretation is still deterministic and mocked.</p></section>
        <section className="auth-panel" aria-labelledby="auth-title"><p className="workspace-eyebrow">ACCOUNT ACCESS</p>{configured ? <SignInForm /> : <><h2 id="auth-title">Welcome back.</h2><p>Supabase is not configured in this environment yet. Add the project URL and public anon key to the local environment to enable sign-in.</p><p className="auth-footnote">No credentials are stored in the repository.</p></>}</section>
      </div>
    </main>
  );
}
