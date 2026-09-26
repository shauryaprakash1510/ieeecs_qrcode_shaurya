/**
 * Web Audio API — Synthesized audio cues for scan results.
 * No external audio files needed. Works offline at venue.
 * SSR Safe: Guards against window / AudioContext absence during Next.js build.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContextClass();
    }
    // Resume suspended context (required after user gesture on mobile)
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  startDelay: number = 0,
  volume: number = 0.3
): void {
  if (typeof window === "undefined") return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startDelay);
    gainNode.gain.setValueAtTime(volume, ctx.currentTime + startDelay);

    // Smooth fade-out to avoid click
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + startDelay + duration
    );

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime + startDelay);
    oscillator.stop(ctx.currentTime + startDelay + duration);
  } catch {
    // Silently fail on unsupported browsers
  }
}

/**
 * SUCCESS: High-frequency ascending double-chime
 * 880Hz → 1200Hz, 100ms each
 */
export function playSuccessChime(): void {
  playTone(880, 0.12, "sine", 0, 0.35);
  playTone(1200, 0.15, "sine", 0.1, 0.35);
}

/**
 * ALREADY_USED: Low-frequency flat warning buzz
 * 220Hz for 400ms
 */
export function playWarningBuzz(): void {
  playTone(220, 0.4, "square", 0, 0.2);
}

/**
 * INVALID: Descending harsh error tone
 * 300Hz → 150Hz rapid descend
 */
export function playErrorBuzz(): void {
  playTone(300, 0.15, "sawtooth", 0, 0.25);
  playTone(200, 0.15, "sawtooth", 0.12, 0.25);
  playTone(150, 0.25, "sawtooth", 0.22, 0.25);
}

/**
 * Initialize audio context on first user gesture.
 * Call this on the first tap/click to unlock mobile audio.
 */
export function initAudio(): void {
  if (typeof window === "undefined") return;
  try {
    getAudioContext();
  } catch {
    // Silent fail
  }
}
