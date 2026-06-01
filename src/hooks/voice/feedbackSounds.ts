/**
 * voiceFeedbackSounds — Web Audio API-based subtle feedback sounds.
 * Tiny sine-wave tones for state transitions. No external files needed.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  durationMs: number,
  volume = 0.08,
  type: OscillatorType = 'sine',
) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Audio context not available — silent fallback
  }
}

/** Ascending two-tone: "ready to listen" */
export function playStartSound() {
  playTone(440, 100, 0.06);
  setTimeout(() => playTone(660, 120, 0.06), 80);
}

/** Descending tone: "stopped listening" */
export function playStopSound() {
  playTone(520, 100, 0.05);
  setTimeout(() => playTone(380, 140, 0.05), 70);
}

/** Short low buzz: "error occurred" */
export function playErrorSound() {
  playTone(220, 180, 0.07, 'triangle');
}

/** Quick high ping: "processing started" */
export function playProcessingSound() {
  playTone(880, 80, 0.04);
}

/** Soft chime: "response ready" */
export function playSpeakingSound() {
  playTone(587, 100, 0.05);
  setTimeout(() => playTone(784, 150, 0.05), 90);
}
