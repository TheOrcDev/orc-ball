/** Level and power-up type definitions */

export type PowerUpType =
  | 'EXPAND'
  | 'SHRINK'
  | 'MULTIBALL'
  | 'STICKY'
  | 'FIREBALL'
  | 'EXTRA_LIFE';

export type BrickCell = '.' | '1' | '2' | '3' | 'X';

export interface LevelDef {
  name: string;
  ballSpeed: number;
  rows: string[];
  dropTable?: Partial<Record<PowerUpType, number>>;
  dropChance?: number;
}

export type BrickKind = 'hp' | 'indestructible';

export interface ParsedBrick {
  col: number;
  row: number;
  kind: BrickKind;
  hp: number;
}

export const ALL_POWER_UP_TYPES: readonly PowerUpType[] = [
  'EXPAND',
  'SHRINK',
  'MULTIBALL',
  'STICKY',
  'FIREBALL',
  'EXTRA_LIFE',
] as const;
