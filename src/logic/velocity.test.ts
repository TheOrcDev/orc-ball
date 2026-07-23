import { describe, expect, it } from 'vitest';
import { MIN_VELOCITY_COMPONENT } from '../config';
import { clampBallSpeed, normalizeSpeedWithMinAxes } from './velocity';

describe('normalizeSpeedWithMinAxes', () => {
  it('renormalizes to exact speed', () => {
    const v = normalizeSpeedWithMinAxes(3, 4, 100);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(100, 5);
  });

  it('corrects near-horizontal velocity with min vertical component', () => {
    const v = normalizeSpeedWithMinAxes(280, 1, 280, MIN_VELOCITY_COMPONENT);
    expect(Math.abs(v.y)).toBeGreaterThanOrEqual(MIN_VELOCITY_COMPONENT - 0.01);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(280, 4);
  });

  it('corrects near-vertical velocity with min horizontal component', () => {
    const v = normalizeSpeedWithMinAxes(1, -280, 280, MIN_VELOCITY_COMPONENT);
    expect(Math.abs(v.x)).toBeGreaterThanOrEqual(MIN_VELOCITY_COMPONENT - 0.01);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(280, 4);
  });

  it('preserves direction signs when possible', () => {
    const v = normalizeSpeedWithMinAxes(-100, -100, 200);
    expect(v.x).toBeLessThan(0);
    expect(v.y).toBeLessThan(0);
  });

  it('handles zero velocity vector without NaN', () => {
    const v = normalizeSpeedWithMinAxes(0, 0, 280);
    expect(Number.isFinite(v.x)).toBe(true);
    expect(Number.isFinite(v.y)).toBe(true);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(280, 4);
  });
});

describe('clampBallSpeed', () => {
  it('clamps to min and max', () => {
    expect(clampBallSpeed(100, 200, 400)).toBe(200);
    expect(clampBallSpeed(500, 200, 400)).toBe(400);
    expect(clampBallSpeed(300, 200, 400)).toBe(300);
  });
});
