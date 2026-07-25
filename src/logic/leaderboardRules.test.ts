import { describe, expect, it } from 'vitest';
import {
  compareEntries,
  insertScore,
  isValidName,
  isValidScore,
  sanitizeName,
  topN,
  type LeaderboardEntry,
} from './leaderboardRules';

describe('sanitizeName', () => {
  it('trims and clamps', () => {
    expect(sanitizeName('  ORC  ')).toBe('ORC');
    expect(sanitizeName('ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJKL');
  });

  it('strips emoji and odd symbols', () => {
    expect(sanitizeName('Orc🔥Dev!')).toBe('OrcDev');
  });

  it('allows spaces, dots, hyphens, underscores', () => {
    expect(sanitizeName('Orc_Dev-1.0')).toBe('Orc_Dev-1.0');
  });
});

describe('isValidName / isValidScore', () => {
  it('accepts normal arcade names', () => {
    expect(isValidName('ORC')).toBe(true);
    expect(isValidName('A')).toBe(true);
    expect(isValidName('Player One')).toBe(true);
  });

  it('rejects empty and overlong', () => {
    expect(isValidName('')).toBe(false);
    expect(isValidName('ABCDEFGHIJKLM')).toBe(false);
  });

  it('accepts integer scores in range', () => {
    expect(isValidScore(1)).toBe(true);
    expect(isValidScore(126920)).toBe(true);
    expect(isValidScore(0)).toBe(false);
    expect(isValidScore(1.5)).toBe(false);
    expect(isValidScore(99_999_999)).toBe(false);
  });
});

describe('ranking', () => {
  const e = (
    id: string,
    name: string,
    score: number,
    at: number,
  ): LeaderboardEntry => ({ id, name, score, at });

  it('sorts by score desc then earlier time', () => {
    const list = [e('a', 'A', 100, 20), e('b', 'B', 200, 30), e('c', 'C', 200, 10)];
    list.sort(compareEntries);
    expect(list.map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('insertScore returns rank and caps list', () => {
    const existing = Array.from({ length: 5 }, (_, i) =>
      e(`e${i}`, `P${i}`, (i + 1) * 100, i),
    );
    const { entries, rank } = insertScore(
      existing,
      e('new', 'HERO', 350, 999),
    );
    expect(rank).toBe(3); // 500, 400, 350, 300, ...
    expect(entries[2]?.id).toBe('new');
    expect(entries.length).toBe(6);
  });

  it('topN ranks 1..n', () => {
    const ranked = topN(
      [e('a', 'A', 10, 1), e('b', 'B', 30, 1), e('c', 'C', 20, 1)],
      2,
    );
    expect(ranked).toEqual([
      expect.objectContaining({ id: 'b', rank: 1 }),
      expect.objectContaining({ id: 'c', rank: 2 }),
    ]);
  });
});
