import { describe, expect, it } from 'vitest';
import { STEER_MAX_DEG } from '../config';
import { paddleHitAngle, velocityFromAngle } from './steering';

describe('paddleHitAngle', () => {
  it('returns -90° (straight up) for center hit', () => {
    expect(paddleHitAngle(400, 400, 120)).toBe(-90);
  });

  it('steers left when ball is on left side of paddle', () => {
    const angle = paddleHitAngle(340, 400, 120);
    expect(angle).toBeLessThan(-90);
    expect(angle).toBeGreaterThanOrEqual(-90 - STEER_MAX_DEG);
  });

  it('steers right when ball is on right side of paddle', () => {
    const angle = paddleHitAngle(460, 400, 120);
    expect(angle).toBeGreaterThan(-90);
    expect(angle).toBeLessThanOrEqual(-90 + STEER_MAX_DEG);
  });

  it('clamps extreme offsets to ±max steer', () => {
    expect(paddleHitAngle(0, 400, 120)).toBe(-90 - STEER_MAX_DEG);
    expect(paddleHitAngle(800, 400, 120)).toBe(-90 + STEER_MAX_DEG);
  });

  it('handles zero width paddle without NaN', () => {
    expect(paddleHitAngle(100, 100, 0)).toBe(-90);
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
  });
});
