import { describe, expect, it } from 'vitest';
import { SLOW_SPEED_FACTOR } from '../config';
import { effectiveBallSpeed } from './slow';

describe('effectiveBallSpeed', () => {
  it('returns base speed when slow is off', () => {
    expect(effectiveBallSpeed(300, false)).toBe(300);
  });

  it('scales by SLOW_SPEED_FACTOR when slow is on', () => {
    expect(effectiveBallSpeed(300, true)).toBe(300 * SLOW_SPEED_FACTOR);
  });

  it('never returns zero or negative', () => {
    expect(effectiveBallSpeed(0, true)).toBe(1);
  });
});
