"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessAction } from "@/lib/business/schemas";

export function useBusinessMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run(action: BusinessAction, success: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/business", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The action failed.");
      setNotice(success);
      router.refresh();
      return body as Record<string, unknown>;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The action failed.");
      return null;
    } finally { setBusy(false); }
  }
  return { busy, error, notice, run };
}
