import { describe, expect, it } from 'vitest';
import { MULTIBALL_CAP } from '../config';
import {
  multiballCloneAngles,
  multiballSpawnSlots,
  shouldLoseLife,
  velocityAngleDeg,
} from './multiball';

describe('multiballSpawnSlots', () => {
  it('respects cap of 12', () => {
    expect(multiballSpawnSlots(0)).toBe(MULTIBALL_CAP);
    expect(multiballSpawnSlots(10)).toBe(2);
    expect(multiballSpawnSlots(12)).toBe(0);
    expect(multiballSpawnSlots(20)).toBe(0);
  });
});

describe('shouldLoseLife', () => {
  it('only when active balls === 0', () => {
    expect(shouldLoseLife(0)).toBe(true);
    expect(shouldLoseLife(1)).toBe(false);
    expect(shouldLoseLife(5)).toBe(false);
  });
});

describe('multiballCloneAngles', () => {
  it('returns ±spread for two clones', () => {
    const angles = multiballCloneAngles(90, 2, 25);
    expect(angles).toEqual([65, 115]);
  });

  it('returns one angle when only one slot', () => {
    const angles = multiballCloneAngles(90, 1, 25);
    expect(angles).toHaveLength(1);
    expect(angles[0]).toBe(115);
  });
});

describe('velocityAngleDeg', () => {
  it('computes angle from velocity', () => {
    expect(velocityAngleDeg(1, 0)).toBeCloseTo(0, 5);
    expect(velocityAngleDeg(0, -1)).toBeCloseTo(-90, 5);
  });
});
