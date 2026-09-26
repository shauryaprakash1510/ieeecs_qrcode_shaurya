/**
 * Haptic feedback via navigator.vibrate API.
 * SSR Safe: Gracefully degrades to no-op on unsupported devices or server rendering.
 */

function vibrate(pattern: number | number[]): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;

  try {
    if ("vibrate" in navigator && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    // Silently fail on unsupported platforms
  }
}

/** SUCCESS: Quick double-tap pulse */
export function vibrateSuccess(): void {
  vibrate([100, 50, 100]);
}

/** ALREADY_USED / INVALID: Long warning pulse */
export function vibrateWarning(): void {
  vibrate([300]);
}

/** INVALID: Strong error pulse */
export function vibrateError(): void {
  vibrate([300]);
}
