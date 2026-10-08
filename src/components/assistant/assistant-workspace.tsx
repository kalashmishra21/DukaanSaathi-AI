"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, AudioLines, CornerDownRight, Mic, RotateCcw, ShieldCheck, Square } from "lucide-react";
import { z } from "zod";
import { assistantResponseSchema, type AssistantResponse } from "@/lib/business/assistant-response";
import { startVoiceRecording, type VoiceRecording } from "@/lib/ai/capture";
import type { VoiceState } from "@/features/assistant/voice-states";
import { VoiceStateIndicator } from "./voice-state-indicator";

type Message = { id: number; role: "user" | "assistant"; text: string };
type ProviderMode = "mock" | "gnani";
type ReasonerMode = "mock" | "openrouter";

const examples = [
  "Maggi ke 20 packet add kar do",
  "Sharma ji ka kitna udhaar hai?",
  "Aaj ki sale batao",
  "Sharma ji ko 100 rupaye udhaar likh do",
];
const transcriptSchema = z.object({ text: z.string().trim().min(1), language: z.string().optional() });
const pause = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

export function AssistantWorkspace({ connected, providerMode, reasonerMode, voiceAvailable }: {
  connected: boolean; providerMode: ProviderMode; reasonerMode: ReasonerMode; voiceAvailable: boolean;
}) {
  const router = useRouter();
  const recording = useRef<VoiceRecording | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: "assistant", text: connected ? "Namaste. Ask about stock, khata or sales. Business results come from your store database." : "Namaste. I can preview a stock adjustment or khata request. Connect a shop to save business actions." }]);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceLanguage, setVoiceLanguage] = useState<"hi-IN" | "en-IN">("hi-IN");
  const [voiceNotice, setVoiceNotice] = useState("");
  const [speechUrl, setSpeechUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastPrompt, setLastPrompt] = useState("");
  const [action, setAction] = useState<AssistantResponse | null>(null);

  useEffect(() => () => {
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    void recording.current?.cancel();
    player.current?.pause();
  }, []);

  async function processPrompt(text: string, speak: boolean) {
    setBusy(true);
    setLastPrompt(text);
    setInput("");
    setAction(null);
    setSpeechUrl("");
    setVoiceNotice("");
    player.current?.pause();

    try {
      setMessages((current) => [...current, { id: Date.now(), role: "user", text }]);
      setVoiceState("reasoning");
      const response = await fetch("/api/assistant/turn", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speak }),
      });
      const body: unknown = await response.json();
      const parsed = assistantResponseSchema.safeParse(body);
      if (!parsed.success) {
        const safeError = z.object({ error: z.string().min(1).max(200) }).safeParse(body);
        throw new Error(response.status === 401 ? "Sign in again to continue." : safeError.success ? safeError.data.error : "The store request could not be processed. No change was confirmed.");
      }
      const turn = parsed.data;
      setVoiceState("executing");
      setAction(turn);
      setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", text: turn.reply }]);
      if (turn.state === "confirmed") router.refresh();
      if (turn.speech) {
        const url = `data:${turn.speech.mimeType};base64,${turn.speech.data}`;
        setSpeechUrl(url);
        setVoiceState("speaking");
        const audio = new Audio(url);
        player.current = audio;
        audio.onended = () => setVoiceState(turn.state === "failed" ? "error" : "idle");
        await audio.play().catch(() => setVoiceNotice("Tap the audio player to hear the reply."));
      } else {
        if (turn.speechUnavailable) setVoiceNotice("Spoken reply is unavailable. The store result is shown in text.");
        setVoiceState(turn.state === "failed" ? "error" : "idle");
      }
    } catch (reason) {
      setVoiceState("error");
      setMessages((current) => [...current, { id: Date.now() + 2, role: "assistant", text: reason instanceof Error ? reason.message : "The request could not be processed. Nothing was confirmed." }]);
    } finally {
      setBusy(false);
    }
  }

  async function runPrompt(rawText: string, sampleVoice = false) {
    const text = rawText.trim();
    if (!text || busy || voiceState === "listening") return;
    if (sampleVoice) {
      setVoiceState("listening");
      await pause(450);
      setVoiceState("transcribing");
      await pause(450);
    }
    await processPrompt(text, false);
  }

  async function stopRecording() {
    const current = recording.current;
    if (!current) return;
    recording.current = null;
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    setVoiceState("transcribing");
    setBusy(true);
    try {
      const bytes = await current.stop();
      const form = new FormData();
      form.set("audio", new File([new Uint8Array(bytes)], "request.wav", { type: "audio/wav" }));
      form.set("language", voiceLanguage);
      const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      const raw: unknown = await response.json();
      const parsed = transcriptSchema.safeParse(raw);
      if (!response.ok || !parsed.success) throw new Error("Transcription failed. No store action was taken; please try again.");
      await processPrompt(parsed.data.text, true);
    } catch (reason) {
      setVoiceState("error");
      setVoiceNotice(reason instanceof Error ? reason.message : "The recording could not be processed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleVoice() {
    if (providerMode === "mock") { await runPrompt(examples[0], true); return; }
    if (recording.current) { await stopRecording(); return; }
    if (busy || !voiceAvailable) return;
    setVoiceNotice("");
    setLastPrompt("");
    setSpeechUrl("");
    player.current?.pause();
    try {
      recording.current = await startVoiceRecording();
      setVoiceState("listening");
      recordingTimer.current = setTimeout(() => void stopRecording(), 12_000);
    } catch {
      setVoiceState("error");
      setVoiceNotice("Microphone access was unavailable. Check browser permission and try again.");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runPrompt(input);
  }

  const realVoice = providerMode === "gnani";
  const realReasoning = reasonerMode === "openrouter";
  return (
    <div className="assistant-page">
      <div className="assistant-heading"><div><p className="workspace-eyebrow">ASSISTANT / COMMAND CENTER</p><h1>Ask Saathi.</h1><p>{realVoice ? `Prisma hears your voice. ${realReasoning ? "OpenRouter" : "Mock reasoning"} selects an intent. Trusted tools confirm store changes before Timbre speaks.` : `${realReasoning ? "OpenRouter" : "Mock AI"} interprets your words. Trusted tools confirm changes only after the database succeeds.`}</p></div><span className="assistant-mode-badge"><span /> {realVoice ? `GNANI VOICE · ${realReasoning ? "OPENROUTER" : "MOCK INTENT"}` : connected ? `${realReasoning ? "OPENROUTER" : "MOCK AI"} · REAL STORE DATA` : "PREVIEW · NO STORE CONNECTED"}</span></div>
      <div className="assistant-grid">
        <section className="conversation-panel" aria-label="Assistant conversation">
          <div className="conversation-head"><div><span className="conversation-head-mark"><AudioLines size={20} strokeWidth={1.5} aria-hidden="true" /></span><div><strong>Conversation</strong><span>{connected ? `${realVoice ? "Gnani voice · " : ""}${realReasoning ? "OpenRouter reasoning" : "mock reasoning"} · connected shop` : "Preview only · no connected shop"}</span></div></div><span>SESSION / LOCAL DEMO</span></div>
          <div className="conversation-feed" aria-live="polite">{messages.map((message) => <div key={message.id} className={`conversation-entry ${message.role}`}><span className="conversation-speaker">{message.role === "user" ? "YOU" : "SAATHI"}</span><p>{message.text}</p></div>)}{busy && <div className="conversation-processing"><span className="processing-dot" /> {voiceState === "transcribing" ? "Transcribing with Prisma" : "Preparing response"}</div>}</div>
          <div className="conversation-bottom"><div className="assistant-examples"><span>TRY A PROMPT</span><div>{examples.map((example) => <button key={example} type="button" onClick={() => void runPrompt(example)} disabled={busy || voiceState === "listening"}>{example}<CornerDownRight size={14} aria-hidden="true" /></button>)}</div></div><form className="assistant-composer" onSubmit={submit}><label htmlFor="assistant-input" className="sr-only">Ask Saathi</label><input id="assistant-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your store…" maxLength={500} disabled={busy || voiceState === "listening"} /><button className="assistant-mic" type="button" disabled={busy || (realVoice && !voiceAvailable)} aria-label={realVoice ? voiceState === "listening" ? "Stop recording" : "Start recording" : "Play sample voice flow; no microphone recording"} title={realVoice ? voiceState === "listening" ? "Stop recording" : "Record with Gnani Prisma" : "Play sample voice flow"} onClick={() => void toggleVoice()}>{realVoice && voiceState === "listening" ? <Square size={17} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}</button><button className="assistant-send" type="submit" disabled={busy || voiceState === "listening" || !input.trim()} aria-label="Send message"><ArrowUp size={19} aria-hidden="true" /></button></form>
            {realVoice && <div className="voice-controls"><label htmlFor="voice-language">Recording language</label><select id="voice-language" value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value as "hi-IN" | "en-IN")} disabled={busy || voiceState === "listening"}><option value="hi-IN">Hindi</option><option value="en-IN">English</option></select></div>}
            <p className="composer-caption">{realVoice ? voiceAvailable ? `Record up to 12 seconds. Prisma and Timbre use programme credits; ${realReasoning ? "OpenRouter" : "mock reasoning"} selects the intent.` : "Add the server-side Gnani API key to enable recording." : "Demo microphone plays a sample phrase. It does not record audio."}</p>
            {voiceNotice && <p className="composer-voice-notice" role="status">{voiceNotice}</p>}
            {speechUrl && <audio controls src={speechUrl} aria-label="Spoken assistant reply" className="assistant-audio" />}
          </div>
        </section>
        <aside className="assistant-context" aria-label="Action context"><div className="assistant-context-top"><span>INTENT & ACTION</span><ShieldCheck size={20} strokeWidth={1.5} aria-hidden="true" /></div><VoiceStateIndicator state={voiceState} realVoice={realVoice} realReasoning={realReasoning} connected={connected} /><div className="action-surface"><p className="action-eyebrow">LATEST REQUEST</p>{action ? <><h2>{action.title}</h2><span className="action-intent">{action.intent}</span><p className="action-detail">{action.detail}</p><div className="action-warning"><ShieldCheck size={18} aria-hidden="true" /><span>{action.state === "confirmed" ? "Confirmed by your store database." : action.state === "failed" ? "No successful change was confirmed. Check the message before retrying." : "Preview only. No trusted tool ran and no store data changed."}</span></div></> : <><h2>Ready for your first request.</h2><p>Send a phrase to see how Saathi prepares a business action.</p><div className="action-empty-lines" aria-hidden="true"><span /><span /><span /></div></>}</div>{voiceState === "error" && lastPrompt && <button className="assistant-retry" type="button" onClick={() => void runPrompt(lastPrompt)} disabled={busy}><RotateCcw size={16} aria-hidden="true" /> Retry last request</button>}<p className="assistant-context-note">{realReasoning ? "OpenRouter" : "Mock AI"} proposes the intent. Only a validated, authenticated server tool and authoritative database result can confirm it.</p></aside>
      </div>
    </div>
  );
}
