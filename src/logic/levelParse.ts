import type { LevelDef, ParsedBrick } from '../data/types';

/**
 * Parse level rows into brick placements.
 * '.' = empty, '1'/'2'/'3' = HP, 'X' = indestructible (fireball-only).
 */
export function parseLevelRows(rows: string[]): ParsedBrick[] {
  const bricks: ParsedBrick[] = [];
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row] ?? '';
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === '.' || ch === undefined || ch === ' ') continue;
      if (ch === 'X' || ch === 'x') {
        bricks.push({ col, row, kind: 'indestructible', hp: Infinity });
        continue;
      }
      const hp = Number(ch);
      if (hp >= 1 && hp <= 9 && Number.isInteger(hp)) {
        bricks.push({ col, row, kind: 'hp', hp });
      }
    }
  }
  return bricks;
}

/** Count bricks that must be destroyed to win (excludes indestructible). */
export function countDestructible(bricks: readonly ParsedBrick[]): number {
  return bricks.filter((b) => b.kind === 'hp').length;
}

/** Win when remaining destructible bricks hit 0. */
export function isLevelClear(destructibleRemaining: number): boolean {
  return destructibleRemaining <= 0;
}

export function parseLevel(def: LevelDef): {
  bricks: ParsedBrick[];
  destructible: number;
} {
  const bricks = parseLevelRows(def.rows);
  return { bricks, destructible: countDestructible(bricks) };
}
