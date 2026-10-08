"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, AudioLines, CornerDownRight, Mic, RotateCcw, ShieldCheck } from "lucide-react";
import { assistantResponseSchema, type AssistantResponse } from "@/lib/business/assistant-response";
import type { VoiceState } from "@/features/assistant/voice-states";
import { VoiceStateIndicator } from "./voice-state-indicator";

type Message = { id: number; role: "user" | "assistant"; text: string };

const examples = [
  "Maggi ke 20 packet add kar do",
  "Sharma ji ka kitna udhaar hai?",
  "Aaj ki total sale batao",
  "Sharma ji ko 100 rupaye udhaar likh do",
];

const pause = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

export function AssistantWorkspace({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: "assistant", text: connected ? "Namaste. I can help with stock, khata and sales using mock understanding and verified store data. What would you like to ask?" : "Namaste. I can preview a stock adjustment or a khata balance request. Connect Supabase to save business actions." }]);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [busy, setBusy] = useState(false);
  const [lastPrompt, setLastPrompt] = useState("");
  const [action, setAction] = useState<AssistantResponse | null>(null);

  async function runPrompt(rawText: string, fromVoice = false) {
    const text = rawText.trim();
    if (!text || busy) return;
    setBusy(true);
    setLastPrompt(text);
    setInput("");
    setAction(null);

    try {
      if (fromVoice) {
        setVoiceState("listening");
        await pause(650);
        setVoiceState("transcribing");
        await pause(520);
      }

      setMessages((current) => [...current, { id: Date.now(), role: "user", text }]);
      setVoiceState("reasoning");
      await pause(320);
      const response = await fetch("/api/mock/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body: unknown = await response.json();
      const parsed = assistantResponseSchema.safeParse(body);
      if (!parsed.success) throw new Error(response.status === 401 ? "Sign in again to continue." : "The store request could not be processed.");
      const turn = parsed.data;
      setVoiceState("executing");
      await pause(350);
      setAction(turn);
      setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", text: turn.reply }]);
      if (turn.state === "failed") { setVoiceState("error"); return; }
      if (turn.state === "confirmed") router.refresh();
      setVoiceState("speaking");
      await pause(420);
      setVoiceState("idle");
    } catch (reason) {
      setVoiceState("error");
      setMessages((current) => [...current, { id: Date.now() + 2, role: "assistant", text: reason instanceof Error ? reason.message : "The request could not be processed. Nothing was confirmed." }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runPrompt(input);
  }

  return (
    <div className="assistant-page">
      <div className="assistant-heading"><div><p className="workspace-eyebrow">ASSISTANT / COMMAND CENTER</p><h1>Ask Saathi.</h1><p>Mock AI interprets your words. Trusted tools confirm changes only after the database succeeds.</p></div><span className="assistant-mode-badge"><span /> {connected ? "MOCK AI · REAL STORE DATA" : "MOCK PREVIEW · NO STORE CONNECTED"}</span></div>
      <div className="assistant-grid">
        <section className="conversation-panel" aria-label="Mock assistant conversation">
          <div className="conversation-head"><div><span className="conversation-head-mark"><AudioLines size={20} strokeWidth={1.5} aria-hidden="true" /></span><div><strong>Conversation</strong><span>{connected ? "Connected shop · mock reasoning" : "Preview only · no connected shop"}</span></div></div><span>SESSION / LOCAL DEMO</span></div>
          <div className="conversation-feed" aria-live="polite">{messages.map((message) => <div key={message.id} className={`conversation-entry ${message.role}`}><span className="conversation-speaker">{message.role === "user" ? "YOU" : "SAATHI"}</span><p>{message.text}</p></div>)}{busy && <div className="conversation-processing"><span className="processing-dot" /> {voiceState === "listening" ? "Playing voice demo" : "Preparing mock response"}</div>}</div>
          <div className="conversation-bottom"><div className="assistant-examples"><span>TRY A PROMPT</span><div>{examples.map((example) => <button key={example} type="button" onClick={() => void runPrompt(example)} disabled={busy}>{example}<CornerDownRight size={14} aria-hidden="true" /></button>)}</div></div><form className="assistant-composer" onSubmit={submit}><label htmlFor="assistant-input" className="sr-only">Ask Saathi</label><input id="assistant-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your store…" maxLength={500} disabled={busy} /><button className="assistant-mic" type="button" disabled={busy} aria-label="Play sample voice flow; no microphone recording" title="Play sample voice flow; no microphone recording" onClick={() => void runPrompt(examples[0], true)}><Mic size={20} aria-hidden="true" /></button><button className="assistant-send" type="submit" disabled={busy || !input.trim()} aria-label="Send message"><ArrowUp size={19} aria-hidden="true" /></button></form><p className="composer-caption">Demo microphone plays a sample phrase. It does not record audio.</p></div>
        </section>
        <aside className="assistant-context" aria-label="Action context"><div className="assistant-context-top"><span>INTENT & ACTION</span><ShieldCheck size={20} strokeWidth={1.5} aria-hidden="true" /></div><VoiceStateIndicator state={voiceState} /><div className="action-surface"><p className="action-eyebrow">LATEST REQUEST</p>{action ? <><h2>{action.title}</h2><span className="action-intent">{action.intent}</span><p className="action-detail">{action.detail}</p><div className="action-warning"><ShieldCheck size={18} aria-hidden="true" /><span>{action.state === "confirmed" ? "Confirmed by your store database." : action.state === "failed" ? "No successful change was confirmed. Check the message before retrying." : "Preview only. No trusted tool ran and no store data changed."}</span></div></> : <><h2>Ready for your first request.</h2><p>Send a phrase to see how Saathi prepares a business action.</p><div className="action-empty-lines" aria-hidden="true"><span /><span /><span /></div></>}</div>{voiceState === "error" && <button className="assistant-retry" type="button" onClick={() => void runPrompt(lastPrompt)} disabled={busy}><RotateCcw size={16} aria-hidden="true" /> Retry last request</button>}<p className="assistant-context-note">Mock AI proposes the intent. Only a validated, authenticated server tool and authoritative database result can confirm it.</p></aside>
      </div>
    </div>
  );
}
