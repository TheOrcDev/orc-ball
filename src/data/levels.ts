import type { LevelDef } from './types';

/** 4–6 authored data-driven levels */
export const LEVELS: LevelDef[] = [
  {
    name: 'Full Wall',
    ballSpeed: 280,
    dropChance: 0.22,
    dropTable: {
      EXPAND: 2,
      SHRINK: 1,
      MULTIBALL: 2,
      STICKY: 1,
      FIREBALL: 1,
      EXTRA_LIFE: 1,
    },
    rows: [
      '1111111111',
      '1111111111',
      '2222222222',
      '1111111111',
      '1111111111',
    ],
  },
  {
    name: 'Checkerboard',
    ballSpeed: 300,
    dropChance: 0.25,
    dropTable: {
      EXPAND: 2,
      SHRINK: 1,
      MULTIBALL: 3,
      STICKY: 2,
      FIREBALL: 1,
      EXTRA_LIFE: 1,
    },
    rows: [
      '1.1.1.1.1.',
      '.2.2.2.2.2',
      '1.1.1.1.1.',
      '.2.2.2.2.2',
      '3.3.3.3.3.',
      '.1.1.1.1.1',
    ],
  },
  {
    name: 'Castle',
    ballSpeed: 310,
    dropChance: 0.28,
    dropTable: {
      EXPAND: 1,
      SHRINK: 1,
      MULTIBALL: 2,
      STICKY: 1,
      FIREBALL: 3,
      EXTRA_LIFE: 1,
    },
    rows: [
      'XX......XX',
      'X22222222X',
      'X2......2X',
      'X2.3333.2X',
      'X2.3XX3.2X',
      'X2.3333.2X',
      'X2......2X',
      'X22222222X',
    ],
  },
  {
    name: 'Diamond',
    ballSpeed: 320,
    dropChance: 0.3,
    dropTable: {
      EXPAND: 2,
      SHRINK: 1,
      MULTIBALL: 2,
      STICKY: 2,
      FIREBALL: 2,
      EXTRA_LIFE: 2,
    },
    rows: [
      '....11....',
      '...1221...',
      '..123321..',
      '.123XX321.',
      '123XXXX321',
      '.123XX321.',
      '..123321..',
      '...1221...',
      '....11....',
    ],
  },
  {
    name: 'Gauntlet',
    ballSpeed: 340,
    dropChance: 0.32,
    dropTable: {
      EXPAND: 1,
      SHRINK: 2,
      MULTIBALL: 3,
      STICKY: 1,
      FIREBALL: 3,
      EXTRA_LIFE: 1,
    },
    rows: [
      '3333333333',
      '3X3X3X3X3X',
      '2222222222',
      'X.X.X.X.X.',
      '1111111111',
      '.2.2.2.2.2',
      '1111XX1111',
      '2222..2222',
    ],
  },
  {
    name: 'Finale',
    ballSpeed: 360,
    dropChance: 0.35,
    dropTable: {
      EXPAND: 2,
      SHRINK: 1,
      MULTIBALL: 3,
      STICKY: 2,
      FIREBALL: 3,
      EXTRA_LIFE: 2,
    },
    rows: [
      '3X3X3X3X3X',
      'X3X3X3X3X3',
      '2222222222',
      '2X2X2X2X2X',
      '1111111111',
      '1.1.1.1.1.',
      '3333XX3333',
      'XX......XX',
      '2222222222',
    ],
  },
];

export function getLevel(index: number): LevelDef | undefined {
  if (index < 0 || index >= LEVELS.length) return undefined;
  return LEVELS[index];
}

export function levelCount(): number {
  return LEVELS.length;
}
