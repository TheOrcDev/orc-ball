import { describe, expect, it } from 'vitest';
import { MULTIBALL_CAP } from '../config';
import {
  clonesForSource,
  multiballCloneAngles,
  multiballSpawnSlots,
  planMultiballSpawns,
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

describe('planMultiballSpawns (multiply every ball)', () => {
  it('multiplies each source by 2 when under cap', () => {
    // 3 balls → 6 new, total would be 9
    expect(planMultiballSpawns(3, 3, 2)).toBe(6);
  });

  it('clamps to remaining cap when swarm is large', () => {
    // 5 balls × 2 = 10 wanted, but only 12-5=7 slots
    expect(planMultiballSpawns(5, 5, 2)).toBe(7);
  });

  it('zero when already at cap', () => {
    expect(planMultiballSpawns(12, 12, 2)).toBe(0);
  });
});

describe('clonesForSource', () => {
  it('gives 2 clones when slots allow', () => {
    expect(clonesForSource(5, 2)).toBe(2);
  });

  it('gives 1 when only one slot left', () => {
    expect(clonesForSource(1, 2)).toBe(1);
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
