import { encodeWav } from "./wav";

export type VoiceRecording = { stop: () => Promise<Uint8Array>; cancel: () => Promise<void> };

export async function startVoiceRecording(): Promise<VoiceRecording> {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) throw new Error("Microphone recording is unavailable in this browser.");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let context: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let processor: AudioWorkletNode | undefined;
  try {
    context = new AudioContext();
    await context.audioWorklet.addModule("/voice-capture-processor.js");
    source = context.createMediaStreamSource(stream);
    processor = new AudioWorkletNode(context, "dukaansaathi-voice-capture");
    const chunks: Float32Array[] = [];
    processor.port.onmessage = (event: MessageEvent<Float32Array>) => chunks.push(event.data);
    source.connect(processor);
    processor.connect(context.destination);
    const sampleRate = context.sampleRate;
    let stopped = false;
    async function cleanup() {
      if (stopped) return;
      stopped = true;
      source?.disconnect();
      processor?.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await context?.close();
    }
    return {
      stop: async () => { await cleanup(); return encodeWav(chunks, sampleRate); },
      cancel: cleanup,
    };
  } catch (error) {
    source?.disconnect();
    processor?.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    await context?.close();
    throw error;
  }
}
