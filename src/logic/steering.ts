import { STEER_MAX_DEG } from '../config';

/**
 * Normalized hit offset on the paddle in [-1, 1].
 * -1 = far left edge, 0 = center, +1 = far right edge.
 */
export function paddleHitOffset(
  ballX: number,
  paddleX: number,
  paddleDisplayWidth: number,
): number {
  const half = paddleDisplayWidth / 2;
  if (half <= 0) return 0;
  return Math.max(-1, Math.min(1, (ballX - paddleX) / half));
}

/**
 * Paddle hit steering angle (degrees).
 * Center → straight up (-90°). Far left → more left (-90 − maxSteer).
 * Far right → more right (-90 + maxSteer). Linear in hit offset (DX-Ball style).
 */
export function paddleHitAngle(
  ballX: number,
  paddleX: number,
  paddleDisplayWidth: number,
  maxSteerDeg: number = STEER_MAX_DEG,
): number {
  const diff = paddleHitOffset(ballX, paddleX, paddleDisplayWidth);
  return -90 + diff * maxSteerDeg;
}

/** Velocity components at given angle (degrees) and speed. Phaser: 0° right, -90° up. */
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

/**
 * Full DX-Ball paddle bounce: exit direction is controlled by where the ball
 * hits the paddle (not arcade surface reflection). Always launches upward.
 * Optional paddleVelocityX adds a small amount of "english" when the paddle is moving.
 */
export function paddleHitVelocity(
  ballX: number,
  paddleX: number,
  paddleDisplayWidth: number,
  speed: number,
  maxSteerDeg: number = STEER_MAX_DEG,
  paddleVelocityX = 0,
  velocityTransfer = 0.2,
): { vx: number; vy: number; angle: number; offset: number } {
  const offset = paddleHitOffset(ballX, paddleX, paddleDisplayWidth);
  const angle = -90 + offset * maxSteerDeg;
  let { vx, vy } = velocityFromAngle(angle, speed);

  if (paddleVelocityX !== 0 && velocityTransfer !== 0) {
    vx += paddleVelocityX * velocityTransfer;
    const mag = Math.hypot(vx, vy);
    if (mag > 1e-6) {
      vx = (vx / mag) * speed;
      vy = (vy / mag) * speed;
    }
  }

  // Always send the ball up after a paddle hit
  if (vy >= 0) {
    const minUp = Math.max(speed * 0.35, 1);
    vy = -minUp;
    const rest = Math.sqrt(Math.max(0, speed * speed - vy * vy));
    vx = (offset === 0 ? (vx >= 0 ? 1 : -1) : Math.sign(offset) || Math.sign(vx) || 1) * rest;
    const mag = Math.hypot(vx, vy);
    if (mag > 1e-6) {
      vx = (vx / mag) * speed;
      vy = (vy / mag) * speed;
    }
  }

  return { vx, vy, angle, offset };
}
