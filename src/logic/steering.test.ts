import { describe, expect, it } from 'vitest';
import { STEER_MAX_DEG } from '../config';
import {
  paddleHitAngle,
  paddleHitOffset,
  paddleHitVelocity,
  velocityFromAngle,
} from './steering';

describe('paddleHitOffset', () => {
  it('is 0 at center, -1 at left edge, +1 at right edge', () => {
    expect(paddleHitOffset(400, 400, 120)).toBe(0);
    expect(paddleHitOffset(340, 400, 120)).toBe(-1);
    expect(paddleHitOffset(460, 400, 120)).toBe(1);
  });

  it('scales linearly between center and edge', () => {
    // half width 60 → 30px left is -0.5
    expect(paddleHitOffset(370, 400, 120)).toBeCloseTo(-0.5, 5);
    expect(paddleHitOffset(430, 400, 120)).toBeCloseTo(0.5, 5);
  });
});

describe('paddleHitAngle', () => {
  it('returns -90° (straight up) for center hit', () => {
    expect(paddleHitAngle(400, 400, 120)).toBe(-90);
  });

  it('steers left when ball is on left side of paddle', () => {
    const angle = paddleHitAngle(340, 400, 120);
    expect(angle).toBe(-90 - STEER_MAX_DEG);
    expect(angle).toBeLessThan(-90);
  });

  it('steers right when ball is on right side of paddle', () => {
    const angle = paddleHitAngle(460, 400, 120);
    expect(angle).toBe(-90 + STEER_MAX_DEG);
    expect(angle).toBeGreaterThan(-90);
  });

  it('clamps extreme offsets to ±max steer', () => {
    expect(paddleHitAngle(0, 400, 120)).toBe(-90 - STEER_MAX_DEG);
    expect(paddleHitAngle(800, 400, 120)).toBe(-90 + STEER_MAX_DEG);
  });

  it('handles zero width paddle without NaN', () => {
    expect(paddleHitAngle(100, 100, 0)).toBe(-90);
  });
});

describe('paddleHitVelocity (DX-Ball)', () => {
  const speed = 280;
  const paddleX = 400;
  const width = 120;

  it('center hit goes straight up (no horizontal)', () => {
    const { vx, vy, offset } = paddleHitVelocity(400, paddleX, width, speed);
    expect(offset).toBe(0);
    expect(Math.abs(vx)).toBeLessThan(1e-6);
    expect(vy).toBeCloseTo(-speed, 5);
  });

  it('far left sends ball left and up', () => {
    const { vx, vy, offset } = paddleHitVelocity(340, paddleX, width, speed);
    expect(offset).toBe(-1);
    expect(vx).toBeLessThan(0);
    expect(vy).toBeLessThan(0);
    expect(Math.hypot(vx, vy)).toBeCloseTo(speed, 5);
    // At max steer, |vx| should be substantial (sin-ish of large angle from vertical)
    expect(Math.abs(vx)).toBeGreaterThan(speed * 0.5);
  });

  it('far right sends ball right and up', () => {
    const { vx, vy, offset } = paddleHitVelocity(460, paddleX, width, speed);
    expect(offset).toBe(1);
    expect(vx).toBeGreaterThan(0);
    expect(vy).toBeLessThan(0);
    expect(Math.hypot(vx, vy)).toBeCloseTo(speed, 5);
    expect(Math.abs(vx)).toBeGreaterThan(speed * 0.5);
  });

  it('mid-left is less extreme than far left', () => {
    const far = paddleHitVelocity(340, paddleX, width, speed);
    const mid = paddleHitVelocity(370, paddleX, width, speed);
    expect(mid.vx).toBeLessThan(0);
    expect(Math.abs(mid.vx)).toBeLessThan(Math.abs(far.vx));
    expect(Math.abs(mid.vy)).toBeGreaterThan(Math.abs(far.vy)); // steeper up
  });

  it('always returns upward velocity', () => {
    for (const x of [300, 340, 400, 460, 500]) {
      const { vy } = paddleHitVelocity(x, paddleX, width, speed);
      expect(vy).toBeLessThan(0);
    }
  });

  it('blends paddle motion into exit angle', () => {
    const still = paddleHitVelocity(400, paddleX, width, speed, STEER_MAX_DEG, 0);
    const moving = paddleHitVelocity(
      400,
      paddleX,
      width,
      speed,
      STEER_MAX_DEG,
      400,
      0.2,
    );
    expect(moving.vx).toBeGreaterThan(still.vx);
    expect(moving.vy).toBeLessThan(0);
    expect(Math.hypot(moving.vx, moving.vy)).toBeCloseTo(speed, 5);
  });
});

describe('velocityFromAngle', () => {
  it('straight up (-90°) has ~0 vx and negative vy', () => {
    const { vx, vy } = velocityFromAngle(-90, 280);
    expect(Math.abs(vx)).toBeLessThan(1e-6);
    expect(vy).toBeCloseTo(-280, 5);
  });

  it('preserves speed magnitude', () => {
    const speed = 300;
    const { vx, vy } = velocityFromAngle(-60, speed);
    expect(Math.hypot(vx, vy)).toBeCloseTo(speed, 5);
  });

  it('pairs with paddleHitAngle for edge hit renormalization', () => {
    const angle = paddleHitAngle(460, 400, 120);
    const speed = 280;
    const { vx, vy } = velocityFromAngle(angle, speed);
    expect(Math.hypot(vx, vy)).toBeCloseTo(speed, 5);
    expect(vy).toBeLessThan(0);
    expect(vx).toBeGreaterThan(0);
  });
});
