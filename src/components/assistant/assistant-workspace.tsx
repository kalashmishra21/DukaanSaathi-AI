"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, AudioLines, Camera, FileText, ImagePlus, Info, Mic, Paperclip, RotateCcw, ShieldCheck, Square, X } from "lucide-react";
import { z } from "zod";
import { assistantResponseSchema, type AssistantResponse } from "@/lib/business/assistant-response";
import { pendingClarificationSchema, type recentTurnSchema } from "@/lib/ai/types/tool-call";
import type { ShoppingDraft } from "@/lib/assistant/shopping-list";
import { prepareShoppingAttachment } from "@/lib/assistant/read-attachment";
import { startVoiceRecording, type VoiceRecording } from "@/lib/ai/capture";
import type { VoiceState } from "@/features/assistant/voice-states";
import { VoiceStateIndicator } from "./voice-state-indicator";
import { ShoppingListResult } from "./shopping-list-result";

type AttachmentPreview = { name: string; kind: "image" | "pdf"; url: string };
type Message = { id: number; role: "user" | "assistant"; text: string; attachment?: AttachmentPreview; result?: AssistantResponse; failed?: boolean };
type ProviderMode = "mock" | "gnani";
type ReasonerMode = "mock" | "openrouter";
type RecentTurn = z.infer<typeof recentTurnSchema>;

const examples = [
  "Maggi ke 20 packet add kar do",
  "Sharma ji ka kitna udhaar hai?",
  "Shopping list: Maggi 2, Parle-G 3",
  "Aaj ki sale batao",
];
const transcriptSchema = z.object({ text: z.string().trim().min(1), language: z.string().optional() });
const errorSchema = z.object({ error: z.string().min(1).max(250) });
const pause = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));

export function AssistantWorkspace({ connected, providerMode, reasonerMode, voiceAvailable }: {
  connected: boolean; providerMode: ProviderMode; reasonerMode: ReasonerMode; voiceAvailable: boolean;
}) {
  const router = useRouter();
  const recording = useRef<VoiceRecording | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const pdfInput = useRef<HTMLInputElement | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const attachmentTrigger = useRef<HTMLButtonElement | null>(null);
  const attachmentMenu = useRef<HTMLDivElement | null>(null);
  const objectUrls = useRef<string[]>([]);
  const latestMessage = useRef<HTMLElement | null>(null);
  const nextId = useRef(1);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<{ file: File; preview: AttachmentPreview } | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<z.infer<typeof pendingClarificationSchema> | null>(null);
  const [inactiveDrafts, setInactiveDrafts] = useState<number[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceLanguage, setVoiceLanguage] = useState<"hi-IN" | "en-IN">("hi-IN");
  const [voiceNotice, setVoiceNotice] = useState("");
  const [speechUrl, setSpeechUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [workingOn, setWorkingOn] = useState<"request" | "attachment" | "voice">("request");
  const [lastPrompt, setLastPrompt] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [action, setAction] = useState<AssistantResponse | null>(null);

  useEffect(() => {
    if (messages.length > 0) latestMessage.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [messages.length]);

  useEffect(() => {
    if (!attachmentMenuOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") { setAttachmentMenuOpen(false); attachmentTrigger.current?.focus(); }
      if (event instanceof MouseEvent && !attachmentMenu.current?.contains(event.target as Node)) setAttachmentMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [attachmentMenuOpen]);

  useEffect(() => () => {
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    void recording.current?.cancel();
    player.current?.pause();
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function addMessage(message: Omit<Message, "id">): number {
    const id = nextId.current++;
    setMessages((current) => [...current, { id, ...message }]);
    return id;
  }

  function recentTurns(): RecentTurn[] {
    return messages.slice(-6).map((message) => ({ role: message.role, text: message.text.slice(0, 500) }));
  }

  async function readTurn(response: Response): Promise<AssistantResponse> {
    const raw: unknown = await response.json();
    const parsed = assistantResponseSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    const safeError = errorSchema.safeParse(raw);
    throw new Error(response.status === 401 ? "Sign in again to continue." : safeError.success
      ? safeError.data.error : "The result could not be verified. Check store records before retrying.");
  }

  async function showTurn(turn: AssistantResponse) {
    setAction(turn);
    setPending(turn.pending ?? null);
    addMessage({ role: "assistant", text: turn.reply, result: turn, failed: turn.state === "failed" });
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
  }

  async function processPrompt(text: string, speak: boolean) {
    setBusy(true);
    setWorkingOn(speak ? "voice" : "request");
    setLastPrompt(text);
    setRetryable(false);
    setInput("");
    setAction(null);
    setSpeechUrl("");
    setVoiceNotice("");
    player.current?.pause();
    const recent = recentTurns();
    addMessage({ role: "user", text });
    try {
      setVoiceState("reasoning");
      const response = await fetch("/api/assistant/turn", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, speak, recent, pending }),
      });
      const turn = await readTurn(response);
      setVoiceState("executing");
      await showTurn(turn);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "The request could not be verified. Check store records before retrying.";
      setVoiceState("error");
      setRetryable(message.includes("Nothing was changed"));
      addMessage({ role: "assistant", text: message, failed: true });
    } finally {
      setBusy(false);
    }
  }

  async function runPrompt(rawText: string, sampleVoice = false) {
    const text = rawText.trim();
    if (!text || busy || voiceState === "listening") return;
    if (sampleVoice) {
      setVoiceState("listening");
      await pause(350);
      setVoiceState("transcribing");
      await pause(350);
    }
    await processPrompt(text, false);
  }

  async function processAttachment() {
    if (!attachment || busy) return;
    setBusy(true);
    setWorkingOn("attachment");
    setAction(null);
    setVoiceNotice("");
    setRetryable(false);
    const selected = attachment;
    setAttachment(null);
    addMessage({ role: "user", text: input.trim() || `Check this shopping list: ${selected.file.name}`, attachment: selected.preview });
    setInput("");
    try {
      setVoiceState("reasoning");
      const prepared = await prepareShoppingAttachment(selected.file);
      const form = new FormData();
      form.set("extractedText", prepared.extractedText);
      prepared.images.forEach((image) => form.append("images", image));
      const response = await fetch("/api/assistant/attachment", { method: "POST", body: form });
      await showTurn(await readTurn(response));
    } catch (reason) {
      setVoiceState("error");
      addMessage({ role: "assistant", text: reason instanceof Error ? reason.message : "The attachment could not be checked. No stock was changed.", failed: true });
    } finally {
      setBusy(false);
    }
  }

  async function confirmSale(draft: ShoppingDraft, paymentMethod: "cash" | "upi" | "card", draftMessageId: number) {
    if (busy || !draft.canConfirm || inactiveDrafts.includes(draftMessageId)) return;
    setBusy(true);
    setAction(null);
    setWorkingOn("request");
    setInactiveDrafts((current) => [...current, draftMessageId]);
    addMessage({ role: "user", text: `Confirm and record this basket · ${paymentMethod.toUpperCase()}` });
    try {
      const items = draft.items.map((item) => ({ productId: z.uuid().parse(item.productId), quantity: item.quantity }));
      const response = await fetch("/api/assistant/confirm-sale", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, items, paymentMethod }),
      });
      await showTurn(await readTurn(response));
    } catch (reason) {
      setVoiceState("error");
      addMessage({ role: "assistant", text: reason instanceof Error ? reason.message : "Sale confirmation was not verified. Check Sales before trying again.", failed: true });
    } finally {
      setBusy(false);
    }
  }

  function chooseFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5_000_000 || file.size === 0 || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
      setVoiceNotice("Choose a JPG, PNG, WebP or PDF file under 5 MB.");
      return;
    }
    if (attachment) URL.revokeObjectURL(attachment.preview.url);
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    setAttachment({ file, preview: { name: file.name, kind: file.type === "application/pdf" ? "pdf" : "image", url } });
    setVoiceNotice("");
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
    if (attachment) void processAttachment();
    else void runPrompt(input);
  }

  const realVoice = providerMode === "gnani";
  const realReasoning = reasonerMode === "openrouter";
  return <div className="assistant-page assistant-copilot">
    <header className="assistant-heading"><div><h1>Ask Saathi<span>.</span></h1><p>Run your store in your own words. Speak, type, or check a shopping list.</p></div><span className="assistant-mode-badge"><span /> {connected ? "STORE CONNECTED" : "PREVIEW MODE"} · {realReasoning ? "AI REASONING" : "MOCK REASONING"}</span></header>
    <div className="assistant-grid">
      <section className="conversation-panel" aria-label="Assistant conversation">
        <div className="conversation-head"><div><span className="conversation-head-mark"><AudioLines size={20} strokeWidth={1.5} aria-hidden="true" /></span><div><strong>Store conversation</strong><span>{connected ? "Answers from your shop records" : "Connect a shop to act"}</span></div></div><span>THIS SESSION</span></div>
        <div className="conversation-feed" aria-live="polite">
          {messages.length === 0 && <div className="assistant-welcome"><div className="assistant-welcome-mark"><AudioLines size={27} strokeWidth={1.4} aria-hidden="true" /></div><h2>What needs doing<br /><em>in your shop?</em></h2><p>{connected ? "Ask a question, update stock, or turn a list into a checked draft. Store changes appear only after they are saved." : "Connect your shop to check real stock, khata, sales and orders."}</p><button className="assistant-speak-primary" type="button" onClick={() => void toggleVoice()} disabled={busy || (realVoice && !voiceAvailable)}><Mic size={19} aria-hidden="true" /> {realVoice ? "Speak to Saathi" : "Try a sample voice request"}</button></div>}
          {messages.map((message, index) => <article ref={index === messages.length - 1 ? latestMessage : undefined} key={message.id} className={`conversation-entry ${message.role}`} data-state={message.failed ? "failed" : message.result?.state}><span className="conversation-speaker">{message.role === "user" ? "YOU" : "SAATHI"}</span><div className="conversation-body">{(message.result || message.failed) && <span className="conversation-outcome">{message.failed ? "Needs attention" : message.result?.state === "confirmed" ? "Store confirmed" : message.result?.state === "draft" ? "For review" : message.result?.state === "unsupported" ? "Try another request" : "Awaiting detail"}</span>}<p>{message.text}</p>
            {message.result && !message.result.shoppingList && message.result.state !== "unsupported" && <div className={`conversation-result ${message.result.state}`}><span>{message.result.state === "confirmed" ? "VERIFIED STORE RESULT" : message.result.state === "draft" ? "DRAFT FOR REVIEW" : message.result.state === "clarify" ? "WAITING FOR YOU" : "STORE RESULT"}</span><strong>{message.result.title}</strong><small>{message.result.detail}</small></div>}
            {message.attachment && <div className="conversation-attachment">{message.attachment.kind === "image" ? <Image unoptimized src={message.attachment.url} alt={`Preview of ${message.attachment.name}`} width={64} height={64} /> : <FileText size={26} aria-hidden="true" />}<span>{message.attachment.name}</span></div>}
            {message.result?.shoppingList && <ShoppingListResult draft={message.result.shoppingList} busy={busy} inactive={inactiveDrafts.includes(message.id)} onConfirm={(draft, payment) => void confirmSale(draft, payment, message.id)} />}
            {message.result?.state === "clarify" && <span className="clarification-hint">{message.result.pending ? "Waiting for an opening amount · nothing saved yet" : "Include the product and quantity · nothing saved yet"}</span>}
          </div></article>)}
          {messages.length === 0 && <div className="assistant-starters"><span>OR START WITH A REQUEST</span><div>{examples.map((example) => <button key={example} type="button" onClick={() => void runPrompt(example)} disabled={busy}>{example}<ArrowUp size={14} aria-hidden="true" /></button>)}</div></div>}
          {busy && <div className="conversation-processing" role="status"><span className="processing-dot" /> {voiceState === "transcribing" ? "Transcribing with Prisma" : workingOn === "attachment" ? "Reading your list; nothing has been changed" : "Checking request and store"}</div>}
        </div>
        <div className="conversation-bottom">
          {pending && <div className="pending-clarification" role="status"><ShieldCheck size={17} aria-hidden="true" /><span>Opening {pending.customer}&apos;s khata · enter the opening amount to continue.</span><button type="button" onClick={() => setPending(null)} aria-label="Cancel this khata request"><X size={16} aria-hidden="true" /></button></div>}
          {attachment && <div className="composer-attachment">{attachment.preview.kind === "image" ? <Image unoptimized src={attachment.preview.url} alt={`Preview of ${attachment.preview.name}`} width={48} height={48} /> : <FileText size={24} aria-hidden="true" />}<span><strong>{attachment.preview.name}</strong><small>Draft check only · no stock change</small></span><button type="button" onClick={() => { URL.revokeObjectURL(attachment.preview.url); setAttachment(null); }} aria-label="Remove attachment"><X size={17} aria-hidden="true" /></button></div>}
          {retryable && lastPrompt && <button className="assistant-retry" type="button" onClick={() => void runPrompt(lastPrompt)} disabled={busy}><RotateCcw size={15} aria-hidden="true" /> Retry safe request</button>}
          <form className="assistant-composer" onSubmit={submit}><label htmlFor="assistant-input" className="sr-only">Ask Saathi</label><input id="assistant-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder={pending ? "e.g. 100 rupaye" : "Ask about stock, khata or a shopping list…"} maxLength={500} disabled={busy || voiceState === "listening"} />
            <div className="assistant-attachment-control" ref={attachmentMenu}>
              <button ref={attachmentTrigger} type="button" className="assistant-attach" onClick={() => setAttachmentMenuOpen((value) => !value)} disabled={busy || voiceState === "listening"} aria-label="Add attachment" aria-expanded={attachmentMenuOpen} aria-controls="assistant-attachment-menu"><Paperclip size={20} aria-hidden="true" /></button>
              {attachmentMenuOpen && <div id="assistant-attachment-menu" className="assistant-attachment-menu">
                <strong>Add a shopping list</strong>
                <button type="button" onClick={() => { setAttachmentMenuOpen(false); fileInput.current?.click(); }}><ImagePlus size={18} aria-hidden="true" /> Upload photo</button>
                <button type="button" onClick={() => { setAttachmentMenuOpen(false); pdfInput.current?.click(); }}><FileText size={18} aria-hidden="true" /> Upload PDF/document</button>
                <button type="button" onClick={() => { setAttachmentMenuOpen(false); cameraInput.current?.click(); }}><Camera size={18} aria-hidden="true" /> Take photo</button>
                <details className="attachment-privacy"><summary><Info size={16} aria-hidden="true" /> Attachments &amp; privacy</summary><p>JPG, PNG, WebP or PDF, up to 5 MB. Files are not saved by DukaanSaathi. Images go to the vision provider. Lists remain drafts until you confirm a sale.</p></details>
              </div>}
            </div>
            <label className="assistant-language-control"><span className="sr-only">Voice language</span><select aria-label="Voice language" value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value as typeof voiceLanguage)} disabled={busy || voiceState === "listening"}><option value="hi-IN">हिंदी</option><option value="en-IN">EN</option></select></label>
            <button className="assistant-mic" type="button" disabled={busy || (realVoice && !voiceAvailable)} aria-label={realVoice ? voiceState === "listening" ? "Stop recording" : "Start recording" : "Play sample voice flow"} onClick={() => void toggleVoice()}>{realVoice && voiceState === "listening" ? <Square size={17} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}<span>{realVoice ? voiceState === "listening" ? "Stop" : "Speak" : "Sample"}</span></button>
            <button className="assistant-send" type="submit" disabled={busy || voiceState === "listening" || (!input.trim() && !attachment)} aria-label="Send message"><ArrowUp size={19} aria-hidden="true" /></button></form>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = ""; }} />
          <input ref={pdfInput} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = ""; }} />
          <input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" tabIndex={-1} onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = ""; }} />
          {voiceNotice && <p className="composer-voice-notice" role="status">{voiceNotice}</p>}
          {speechUrl && <audio controls src={speechUrl} aria-label="Spoken assistant reply" className="assistant-audio" />}
        </div>
      </section>
      {(action || voiceState !== "idle") && <aside className="assistant-context" aria-label="Action context"><div className="assistant-context-top"><span>TRUSTED ACTION</span><ShieldCheck size={19} strokeWidth={1.5} aria-hidden="true" /></div><VoiceStateIndicator state={voiceState} realVoice={realVoice} realReasoning={realReasoning} connected={connected} />
        <div className="action-surface"><p className="action-eyebrow">LATEST RESULT</p>{action ? <><h2>{action.title}</h2><span className="action-intent">{action.intent}</span><p className="action-detail">{action.detail}</p><div className="action-warning"><ShieldCheck size={17} aria-hidden="true" /><span>{action.state === "confirmed" ? "Confirmed by your store database." : action.state === "draft" ? "Draft only. Review and confirm to record a sale." : action.state === "clarify" ? "Waiting for your answer. No change saved." : "No successful change was confirmed."}</span></div></> : <><h2>Your next action starts here.</h2><p>Saathi will show the intent, store result and any decision that needs your confirmation.</p></>}</div>
        <p className="assistant-context-note">{realReasoning ? "AI" : "Mock AI"} interprets your request. Your shop records decide the answer. Saathi confirms a change only when it is saved.</p>
      </aside>}
    </div>
  </div>;
}
