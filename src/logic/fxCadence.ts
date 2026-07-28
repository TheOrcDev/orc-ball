/**
 * Advances a visual-effect redraw clock without accumulating an unbounded
 * backlog after a paused or throttled frame.
 */
export function advanceFxRedrawClock(
  elapsedMs: number,
  deltaMs: number,
  intervalMs: number,
): number {
  if (intervalMs <= 0) return 0;
  return Math.min(
    intervalMs,
    Math.max(0, elapsedMs) + Math.max(0, deltaMs),
  );
}

export function isFxRedrawDue(
  elapsedMs: number,
  intervalMs: number,
): boolean {
  return intervalMs <= 0 || elapsedMs >= intervalMs;
}

/**
 * Particle emitter processors are shared by themes of the same rendering
 * style; palette and frequency can be updated independently.
 */
export function shouldReconfigureParticleStyle(
  currentStyle: 'electric' | 'glue',
  nextStyle: 'electric' | 'glue',
): boolean {
  return currentStyle !== nextStyle;
}
