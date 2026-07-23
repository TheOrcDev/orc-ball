import { SLOW_SPEED_FACTOR } from '../config';

/** Effective flight speed while SLOW is active. */
export function effectiveBallSpeed(
  baseSpeed: number,
  slowActive: boolean,
  factor: number = SLOW_SPEED_FACTOR,
): number {
  if (!slowActive) return baseSpeed;
  return Math.max(1, baseSpeed * factor);
}
