import { STEER_MAX_DEG } from '../config';

/**
 * Paddle hit steering: offset from paddle center maps to launch angle.
 * Center → straight up (-90°). Edges → ±STEER_MAX_DEG from vertical.
 * Returns angle in degrees for Phaser Math.velocityFromAngle.
 */
export function paddleHitAngle(
  ballX: number,
  paddleX: number,
  paddleDisplayWidth: number,
  maxSteerDeg: number = STEER_MAX_DEG,
): number {
  const half = paddleDisplayWidth / 2;
  if (half <= 0) return -90;
  const diff = Math.max(-1, Math.min(1, (ballX - paddleX) / half));
  return -90 + diff * maxSteerDeg;
}

/** Velocity components at given angle (degrees) and speed. */
export function velocityFromAngle(
  angleDeg: number,
  speed: number,
): { vx: number; vy: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    vx: Math.cos(rad) * speed,
    vy: Math.sin(rad) * speed,
  };
}
