export function encodeWav(chunks: Float32Array[], inputRate: number): Uint8Array {
  if (!Number.isFinite(inputRate) || inputRate < 8000 || inputRate > 192000) throw new Error("Invalid microphone sample rate.");
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (total / inputRate < 0.25 || total / inputRate > 15) throw new Error("Record between 0.25 and 15 seconds.");
  const input = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) { input.set(chunk, offset); offset += chunk.length; }
  const outputRate = 16000;
  const outputLength = Math.floor(total * outputRate / inputRate);
  const bytes = new Uint8Array(44 + outputLength * 2);
  const view = new DataView(bytes.buffer);
  function ascii(position: number, value: string) {
    for (let index = 0; index < value.length; index++) view.setUint8(position + index, value.charCodeAt(index));
  }
  ascii(0, "RIFF"); view.setUint32(4, bytes.length - 8, true); ascii(8, "WAVE");
  ascii(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, outputRate, true);
  view.setUint32(28, outputRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, "data"); view.setUint32(40, outputLength * 2, true);
  for (let index = 0; index < outputLength; index++) {
    const sample = input[Math.min(total - 1, Math.floor(index * inputRate / outputRate))];
    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, Math.round(clipped < 0 ? clipped * 32768 : clipped * 32767), true);
  }
  return bytes;
}

export function isShortWav(bytes: Uint8Array): boolean {
  if (bytes.length < 44 || bytes.length > 1_000_000) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  return text(0, 4) === "RIFF" && text(8, 4) === "WAVE" && text(12, 4) === "fmt " && text(36, 4) === "data"
    && view.getUint32(4, true) === bytes.length - 8 && view.getUint32(16, true) === 16
    && view.getUint16(20, true) === 1 && view.getUint16(22, true) === 1
    && view.getUint32(24, true) === 16000 && view.getUint32(28, true) === 32000
    && view.getUint16(32, true) === 2 && view.getUint16(34, true) === 16
    && view.getUint32(40, true) === bytes.length - 44
    && (bytes.length - 44) / 32000 >= 0.25 && (bytes.length - 44) / 32000 <= 15;
}
