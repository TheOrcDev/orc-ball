import { describe, expect, it } from 'vitest';
import { LEVELS } from '../data/levels';
import {
  countDestructible,
  isLevelClear,
  parseLevel,
  parseLevelRows,
} from './levelParse';

describe('parseLevelRows', () => {
  it('parses HP cells and skips empty', () => {
    const bricks = parseLevelRows(['1.2', 'X3.']);
    expect(bricks).toEqual([
      { col: 0, row: 0, kind: 'hp', hp: 1 },
      { col: 2, row: 0, kind: 'hp', hp: 2 },
      { col: 0, row: 1, kind: 'indestructible', hp: Infinity },
      { col: 1, row: 1, kind: 'hp', hp: 3 },
    ]);
  });

  it('marks X as indestructible', () => {
    const bricks = parseLevelRows(['X']);
    expect(bricks[0]?.kind).toBe('indestructible');
  });
});

describe('countDestructible / isLevelClear', () => {
  it('excludes indestructible from win count', () => {
    const bricks = parseLevelRows(['1X2', 'XXX']);
    expect(countDestructible(bricks)).toBe(2);
  });

  it('win when destructible remaining is 0', () => {
    expect(isLevelClear(0)).toBe(true);
    expect(isLevelClear(1)).toBe(false);
    expect(isLevelClear(-1)).toBe(true);
  });
});

describe('authored levels', () => {
  it('has 4–6 levels', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(4);
    expect(LEVELS.length).toBeLessThanOrEqual(6);
  });

  it('each level parses with at least one destructible brick', () => {
    for (const level of LEVELS) {
      const { destructible } = parseLevel(level);
      expect(destructible).toBeGreaterThan(0);
      expect(level.ballSpeed).toBeGreaterThan(0);
      expect(level.rows.length).toBeGreaterThan(0);
    }
  });

  it('Castle level includes indestructible X bricks', () => {
    const castle = LEVELS.find((l) => l.name === 'Castle');
    expect(castle).toBeDefined();
    const { bricks, destructible } = parseLevel(castle!);
    const xCount = bricks.filter((b) => b.kind === 'indestructible').length;
    expect(xCount).toBeGreaterThan(0);
    expect(destructible).toBe(bricks.length - xCount);
  });
});
