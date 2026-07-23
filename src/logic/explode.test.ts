import { describe, expect, it } from 'vitest';
import {
  crossOffsets,
  isOrthogonalNeighbor,
  orthogonalNeighbors,
} from './explode';

describe('isOrthogonalNeighbor', () => {
  const c = { col: 3, row: 4 };

  it('true for up / down / left / right', () => {
    expect(isOrthogonalNeighbor(c, { col: 3, row: 3 })).toBe(true);
    expect(isOrthogonalNeighbor(c, { col: 3, row: 5 })).toBe(true);
    expect(isOrthogonalNeighbor(c, { col: 2, row: 4 })).toBe(true);
    expect(isOrthogonalNeighbor(c, { col: 4, row: 4 })).toBe(true);
  });

  it('false for self, diagonals, and far cells', () => {
    expect(isOrthogonalNeighbor(c, c)).toBe(false);
    expect(isOrthogonalNeighbor(c, { col: 4, row: 5 })).toBe(false);
    expect(isOrthogonalNeighbor(c, { col: 5, row: 4 })).toBe(false);
  });
});

describe('orthogonalNeighbors', () => {
  it('returns only the four cross cells that exist', () => {
    const center = { col: 1, row: 1, id: 'c' };
    const cells = [
      center,
      { col: 1, row: 0, id: 'up' },
      { col: 1, row: 2, id: 'down' },
      { col: 0, row: 1, id: 'left' },
      { col: 2, row: 1, id: 'right' },
      { col: 2, row: 2, id: 'diag' },
      { col: 5, row: 5, id: 'far' },
    ];
    const n = orthogonalNeighbors(center, cells);
    expect(n.map((x) => x.id).sort()).toEqual(
      ['down', 'left', 'right', 'up'].sort(),
    );
  });
});

describe('crossOffsets', () => {
  it('has four unique axis offsets', () => {
    expect(crossOffsets()).toHaveLength(4);
    expect(new Set(crossOffsets().map((o) => `${o.col},${o.row}`)).size).toBe(
      4,
    );
  });
});
