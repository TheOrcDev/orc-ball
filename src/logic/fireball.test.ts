import { describe, expect, it } from 'vitest';
import {
  canDamageBrick,
  shouldProcessBallBrickCollision,
} from './fireball';

describe('shouldProcessBallBrickCollision', () => {
  it('returns true for normal balls (run collision)', () => {
    expect(shouldProcessBallBrickCollision(false)).toBe(true);
  });

  it('returns false for fireballs (pass-through)', () => {
    expect(shouldProcessBallBrickCollision(true)).toBe(false);
  });
});

describe('canDamageBrick', () => {
  it('normal ball damages HP bricks only', () => {
    expect(canDamageBrick(false, false)).toBe(true);
    expect(canDamageBrick(false, true)).toBe(false);
  });

  it('fireball damages both HP and indestructible', () => {
    expect(canDamageBrick(true, false)).toBe(true);
    expect(canDamageBrick(true, true)).toBe(true);
  });
});
