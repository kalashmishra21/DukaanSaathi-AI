"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  async function signOut() {
    const client = createSupabaseBrowserClient();
    if (!client) { setError("Connection unavailable."); return; }
    const { error: authError } = await client.auth.signOut();
    if (authError) { setError("Could not sign out. Please try again."); return; }
    router.replace("/signin");
    router.refresh();
  }
  return <span className="signout-control"><button className="workspace-signout" type="button" onClick={() => void signOut()}>Sign out</button>{error && <span role="alert" className="signout-error">{error}</span>}</span>;
}
