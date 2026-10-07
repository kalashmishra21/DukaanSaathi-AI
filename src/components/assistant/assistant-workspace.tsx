"use client";

import { useState, type FormEvent } from "react";
import { ArrowUp, AudioLines, CornerDownRight, Mic, RotateCcw, ShieldCheck } from "lucide-react";
import { reasoningResultSchema } from "@/lib/ai/types/tool-call";
import { describeMockTurn, type MockTurn } from "@/features/assistant/mock-turn";
import type { VoiceState } from "@/features/assistant/voice-states";
import { VoiceStateIndicator } from "./voice-state-indicator";

type Message = { id: number; role: "user" | "assistant"; text: string };

const examples = [
  "Maggi ke 20 packet add kar do",
  "Sharma ji ka kitna udhaar hai?",
  "Aaj ki total sale batao",
];

const pause = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

export function AssistantWorkspace() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: "assistant", text: "Namaste. I can preview a stock adjustment or a khata balance request. What would you like to ask?" }]);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [busy, setBusy] = useState(false);
  const [lastPrompt, setLastPrompt] = useState("");
  const [action, setAction] = useState<MockTurn | null>(null);

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
      if (!response.ok) throw new Error("Mock request failed");
      const reasoning = reasoningResultSchema.parse(await response.json());
      setVoiceState("executing");
      await pause(350);
      const turn = describeMockTurn(reasoning);
      setAction(turn);
      setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", text: turn.reply }]);
      setVoiceState("speaking");
      await pause(420);
      setVoiceState("idle");
    } catch {
      setVoiceState("error");
      setMessages((current) => [...current, { id: Date.now() + 2, role: "assistant", text: "The mock request could not be processed. Please try again." }]);
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
      <div className="assistant-heading"><div><p className="workspace-eyebrow">ASSISTANT / COMMAND CENTER</p><h1>Ask Saathi.</h1><p>Your words become structured previews. A real tool must confirm any business change.</p></div><span className="assistant-mode-badge"><span /> OFFLINE MOCK MODE</span></div>
      <div className="assistant-grid">
        <section className="conversation-panel" aria-label="Mock assistant conversation">
          <div className="conversation-head"><div><span className="conversation-head-mark"><AudioLines size={20} strokeWidth={1.5} aria-hidden="true" /></span><div><strong>Conversation</strong><span>Store context will appear here later</span></div></div><span>SESSION / LOCAL DEMO</span></div>
          <div className="conversation-feed" aria-live="polite">{messages.map((message) => <div key={message.id} className={`conversation-entry ${message.role}`}><span className="conversation-speaker">{message.role === "user" ? "YOU" : "SAATHI"}</span><p>{message.text}</p></div>)}{busy && <div className="conversation-processing"><span className="processing-dot" /> {voiceState === "listening" ? "Playing voice demo" : "Preparing mock response"}</div>}</div>
          <div className="conversation-bottom"><div className="assistant-examples"><span>TRY A PROMPT</span><div>{examples.map((example) => <button key={example} type="button" onClick={() => void runPrompt(example)} disabled={busy}>{example}<CornerDownRight size={14} aria-hidden="true" /></button>)}</div></div><form className="assistant-composer" onSubmit={submit}><label htmlFor="assistant-input" className="sr-only">Ask Saathi</label><input id="assistant-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your store…" maxLength={500} disabled={busy} /><button className="assistant-mic" type="button" disabled={busy} aria-label="Play sample voice flow; no microphone recording" title="Play sample voice flow; no microphone recording" onClick={() => void runPrompt(examples[0], true)}><Mic size={20} aria-hidden="true" /></button><button className="assistant-send" type="submit" disabled={busy || !input.trim()} aria-label="Send message"><ArrowUp size={19} aria-hidden="true" /></button></form><p className="composer-caption">Demo microphone plays a sample phrase. It does not record audio.</p></div>
        </section>
        <aside className="assistant-context" aria-label="Action context"><div className="assistant-context-top"><span>INTENT & ACTION</span><ShieldCheck size={20} strokeWidth={1.5} aria-hidden="true" /></div><VoiceStateIndicator state={voiceState} /><div className="action-surface"><p className="action-eyebrow">LATEST REQUEST</p>{action ? <><h2>{action.title}</h2><span className="action-intent">{action.intent}</span><p className="action-detail">{action.detail}</p><div className="action-warning"><ShieldCheck size={18} aria-hidden="true" /><span>Preview only. No trusted tool ran and no store data changed.</span></div></> : <><h2>Ready for your first request.</h2><p>Send a phrase to see how Saathi prepares a business action.</p><div className="action-empty-lines" aria-hidden="true"><span /><span /><span /></div></>}</div>{voiceState === "error" && <button className="assistant-retry" type="button" onClick={() => void runPrompt(lastPrompt)} disabled={busy}><RotateCcw size={16} aria-hidden="true" /> Retry last request</button>}<p className="assistant-context-note">The assistant only claims success after a trusted server tool confirms a change. Tools are not connected in this phase.</p></aside>
      </div>
    </div>
  );
}
