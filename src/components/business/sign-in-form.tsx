"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignInForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const client = createSupabaseBrowserClient();
    if (!client) { setError("Supabase is not configured."); setBusy(false); return; }
    try {
      if (mode === "signin") {
        const { error: authError } = await client.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace("/app");
        router.refresh();
      } else {
        const { data, error: authError } = await client.auth.signUp({
          email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (authError) throw authError;
        if (data.session) { router.replace("/app"); router.refresh(); }
        else setNotice("Check your email for the confirmation link, then return to sign in.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed.");
    } finally { setBusy(false); }
  }
  return <><div className="auth-tabs" role="group" aria-label="Account action"><button type="button" aria-pressed={mode === "signin"} onClick={() => setMode("signin")}>Sign in</button><button type="button" aria-pressed={mode === "signup"} onClick={() => setMode("signup")}>Create account</button></div><form className="business-form auth-form" onSubmit={(event) => void submit(event)}><label>Email<input type="email" name="email" autoComplete="email" required /></label><label>Password<input type="password" name="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} required /></label><button className="button button-copper" disabled={busy} type="submit">{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button></form>{notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}<p className="auth-footnote">Your shop records are private to your account. Email confirmation may be required by your Supabase project.</p></>;
}
