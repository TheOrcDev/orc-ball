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
  it('has at least 20 levels', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(20);
  });

  it('each level parses with at least one destructible brick', () => {
    for (const level of LEVELS) {
      const { destructible } = parseLevel(level);
      expect(destructible).toBeGreaterThan(0);
      expect(level.ballSpeed).toBeGreaterThan(0);
      expect(level.rows.length).toBeGreaterThan(0);
      expect(level.name.length).toBeGreaterThan(0);
    }
  });

  it('level names are unique', () => {
    const names = LEVELS.map((l) => l.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('ball speed ramps across the campaign', () => {
    const first = LEVELS[0]!.ballSpeed;
    const last = LEVELS[LEVELS.length - 1]!.ballSpeed;
    expect(last).toBeGreaterThan(first);
  });

  it('Castle level includes indestructible X bricks', () => {
    const castle = LEVELS.find((l) => l.name === 'Castle');
    expect(castle).toBeDefined();
    const { bricks, destructible } = parseLevel(castle!);
    const xCount = bricks.filter((b) => b.kind === 'indestructible').length;
    expect(xCount).toBeGreaterThan(0);
    expect(destructible).toBe(bricks.length - xCount);
  });

  it('Ring keeps a bottom passage through the concrete shell', () => {
    const ring = LEVELS.find((l) => l.name === 'Ring');
    expect(ring).toBeDefined();
    const bottom = ring!.rows[ring!.rows.length - 1]!;
    const passageCells = [...bottom].filter((c) => c === '.').length;
    expect(passageCells).toBeGreaterThanOrEqual(2);
  });

  it('late levels include X bricks requiring fireball', () => {
    const late = LEVELS.slice(-5);
    const withX = late.filter((l) => l.rows.some((r) => r.includes('X')));
    expect(withX.length).toBeGreaterThanOrEqual(3);
  });
});
