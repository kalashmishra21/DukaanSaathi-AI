import { AudioLines, CircleAlert, CircleCheck, CircleDot, LoaderCircle, Mic, ScanText, Volume2 } from "lucide-react";
import { voiceStates, type VoiceState } from "@/features/assistant/voice-states";

const icons = { idle: CircleDot, listening: Mic, transcribing: ScanText, reasoning: LoaderCircle, executing: CircleCheck, speaking: Volume2, error: CircleAlert };

export function VoiceStateIndicator({ state, realVoice = false, connected = false }: { state: VoiceState; realVoice?: boolean; connected?: boolean }) {
  const Icon = icons[state];
  const detail = realVoice && state === "listening" ? "Microphone is recording. Stop when finished."
    : realVoice && state === "transcribing" ? "Gnani Prisma is turning speech into text."
    : realVoice && state === "speaking" ? "Gnani Timbre is playing the verified reply."
    : connected && state === "executing" ? "A trusted server tool is checking store data."
    : voiceStates[state].detail;
  return <div className="voice-state" data-state={state} role="status" aria-live="polite"><span className="voice-state-icon"><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></span><div><strong>{voiceStates[state].label}</strong><span>{detail}</span></div><AudioLines className="voice-state-wave" size={25} strokeWidth={1.3} aria-hidden="true" /></div>;
}
