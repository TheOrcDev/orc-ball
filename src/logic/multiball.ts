import { MULTIBALL_CAP, MULTIBALL_SPREAD_DEG } from '../config';

/** How many new balls can still spawn given current active count. */
export function multiballSpawnSlots(
  activeCount: number,
  cap: number = MULTIBALL_CAP,
): number {
  return Math.max(0, cap - activeCount);
}

/** Life lost only when no active balls remain. */
export function shouldLoseLife(activeBallCount: number): boolean {
  return activeBallCount === 0;
}

/**
 * Angles (degrees) for clone balls relative to source velocity angle.
 * Returns ±spread for up to 2 clones; caller may spawn fewer by slots.
 */
export function multiballCloneAngles(
  sourceAngleDeg: number,
  count: number,
  spreadDeg: number = MULTIBALL_SPREAD_DEG,
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [sourceAngleDeg + spreadDeg];
  return [sourceAngleDeg - spreadDeg, sourceAngleDeg + spreadDeg].slice(0, count);
}

export function velocityAngleDeg(vx: number, vy: number): number {
  return (Math.atan2(vy, vx) * 180) / Math.PI;
}
