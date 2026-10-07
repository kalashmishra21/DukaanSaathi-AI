import { AudioLines, CircleAlert, CircleCheck, CircleDot, LoaderCircle, Mic, ScanText, Volume2 } from "lucide-react";
import { voiceStates, type VoiceState } from "@/features/assistant/voice-states";

const icons = { idle: CircleDot, listening: Mic, transcribing: ScanText, reasoning: LoaderCircle, executing: CircleCheck, speaking: Volume2, error: CircleAlert };

export function VoiceStateIndicator({ state }: { state: VoiceState }) {
  const Icon = icons[state];
  return <div className="voice-state" data-state={state} role="status" aria-live="polite"><span className="voice-state-icon"><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></span><div><strong>{voiceStates[state].label}</strong><span>{voiceStates[state].detail}</span></div><AudioLines className="voice-state-wave" size={25} strokeWidth={1.3} aria-hidden="true" /></div>;
}
