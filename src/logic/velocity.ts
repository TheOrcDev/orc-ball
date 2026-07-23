import { MIN_VELOCITY_COMPONENT } from '../config';

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Renormalize velocity to exactly `speed`, then enforce minimum
 * horizontal AND vertical components so balls never stick in pure H/V loops.
 */
export function normalizeSpeedWithMinAxes(
  vx: number,
  vy: number,
  speed: number,
  minComponent: number = MIN_VELOCITY_COMPONENT,
): Vec2 {
  let x = vx;
  let y = vy;
  const mag = Math.hypot(x, y);
  if (mag < 1e-6 || speed <= 0) {
    // Default slightly off-vertical upward
    return { x: minComponent * 0.5, y: -Math.sqrt(Math.max(0, speed * speed - (minComponent * 0.5) ** 2)) || -speed };
  }
  x = (x / mag) * speed;
  y = (y / mag) * speed;

  // Enforce minimum |vy|
  if (Math.abs(y) < minComponent) {
    const signY = y === 0 ? (vy < 0 || vy === 0 ? -1 : 1) : Math.sign(y);
    y = signY * minComponent;
    const rest = Math.sqrt(Math.max(0, speed * speed - y * y));
    x = (x === 0 ? (vx >= 0 ? 1 : -1) : Math.sign(x)) * rest;
  }

  // Enforce minimum |vx|
  if (Math.abs(x) < minComponent) {
    const signX = x === 0 ? (vx >= 0 ? 1 : -1) : Math.sign(x);
    x = signX * minComponent;
    const rest = Math.sqrt(Math.max(0, speed * speed - x * x));
    const signY = y === 0 ? -1 : Math.sign(y);
    y = signY * rest;
  }

  // Final renormalize in case of float drift
  const m2 = Math.hypot(x, y);
  if (m2 > 1e-6) {
    x = (x / m2) * speed;
    y = (y / m2) * speed;
  }
  return { x, y };
}

/** Clamp ball speed between defaults and max. */
export function clampBallSpeed(speed: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, speed));
}
