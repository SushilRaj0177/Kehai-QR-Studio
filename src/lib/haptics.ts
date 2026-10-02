/**
 * Haptic feedback through the Vibration API (Android: Chrome, Samsung
 * Internet, Firefox). Browsers without it, including Safari on iPhone,
 * simply get no vibration. Every pattern is short and subtle: a buzz is
 * confirmation, never decoration.
 */

export const HAPTICS = {
  /** A finger pressed a button, chip or card. */
  tap: 8,
  /** A slider or the colour picker moved a step while dragged. */
  tick: 4,
  /** A touch took hold of a slider or the colour picker. */
  grab: 12,
  /** Download, copy, share or save worked. */
  success: [10, 60, 18],
  /** Something failed (the error toast). */
  error: [24, 50, 24],
} as const;

export type Haptic = keyof typeof HAPTICS;

/** Ticks closer together than this merge into one (a fast drag would otherwise hum). */
export const TICK_GAP_MS = 45;
let lastTick = -Infinity;

/** Buzz once with the named pattern. Returns true if the device accepted it. */
export function haptic(kind: Haptic): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  if (kind === "tick") {
    const now = performance.now();
    if (now - lastTick < TICK_GAP_MS) return false;
    lastTick = now;
  }
  try {
    return navigator.vibrate(HAPTICS[kind] as number | number[]);
  } catch {
    return false;
  }
}

/** For tests: forget the last tick. */
export function resetHaptics(): void {
  lastTick = -Infinity;
}
