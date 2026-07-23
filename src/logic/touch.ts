/** Tap vs drag thresholds for pointer launch gestures. */
export const TAP_MAX_DIST = 20;
export const TAP_MAX_MS = 400;

/**
 * True when we should show on-screen touch chrome (LAUNCH button, touch hints).
 * Coarse pointer, multi-touch, or a narrow viewport.
 */
export function prefersTouchUi(
  opts: {
    maxTouchPoints?: number;
    coarsePointer?: boolean;
    innerWidth?: number;
    innerHeight?: number;
  } = {},
): boolean {
  const maxTouchPoints =
    opts.maxTouchPoints ??
    (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0);
  const coarsePointer =
    opts.coarsePointer ??
    (typeof window !== 'undefined'
      ? Boolean(window.matchMedia?.('(pointer: coarse)').matches)
      : false);
  const w =
    opts.innerWidth ??
    (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const h =
    opts.innerHeight ??
    (typeof window !== 'undefined' ? window.innerHeight : 800);

  const smallScreen = w < 900 || h < 650;
  const touchCapable = maxTouchPoints > 0 || coarsePointer;
  return touchCapable || smallScreen;
}

/** Short press with little movement = tap (launch / confirm). */
export function isTapGesture(
  downX: number,
  downY: number,
  upX: number,
  upY: number,
  durationMs: number,
  maxDist: number = TAP_MAX_DIST,
  maxDurationMs: number = TAP_MAX_MS,
): boolean {
  if (durationMs < 0 || durationMs > maxDurationMs) return false;
  const dist = Math.hypot(upX - downX, upY - downY);
  return dist <= maxDist;
}

/** Clamp paddle center X inside world bounds for a given half-width. */
export function clampPaddleX(
  x: number,
  halfWidth: number,
  worldWidth: number,
): number {
  return Math.max(halfWidth, Math.min(worldWidth - halfWidth, x));
}
