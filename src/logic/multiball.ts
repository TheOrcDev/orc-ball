import { MULTIBALL_CAP, MULTIBALL_SPREAD_DEG } from '../config';

/** How many new balls can still spawn given current active count. */
export function multiballSpawnSlots(
  activeCount: number,
  cap: number = MULTIBALL_CAP,
): number {
  return Math.max(0, cap - activeCount);
}

/**
 * Total new balls when every source ball is multiplied by clonesPerSource,
 * clamped to remaining cap slots.
 */
export function planMultiballSpawns(
  sourceCount: number,
  activeCount: number,
  clonesPerSource = 2,
  cap: number = MULTIBALL_CAP,
): number {
  if (sourceCount <= 0 || clonesPerSource <= 0) return 0;
  const wanted = sourceCount * clonesPerSource;
  return Math.min(wanted, multiballSpawnSlots(activeCount, cap));
}

/** Clones to spawn for one source given remaining global slots. */
export function clonesForSource(
  remainingSlots: number,
  clonesPerSource = 2,
): number {
  return Math.max(0, Math.min(clonesPerSource, remainingSlots));
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
