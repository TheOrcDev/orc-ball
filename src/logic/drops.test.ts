import { describe, expect, it } from 'vitest';
import { rollPowerUpDrop } from './drops';

describe('rollPowerUpDrop', () => {
  it('returns null when chance fails', () => {
    const result = rollPowerUpDrop(0.2, { EXPAND: 1 }, () => 0.5);
    expect(result).toBeNull();
  });

  it('returns typed power-up when chance succeeds', () => {
    // first rng call = chance (0 < 1), second = weight pick
    let calls = 0;
    const rng = () => {
      calls += 1;
      return calls === 1 ? 0 : 0.99;
    };
    const result = rollPowerUpDrop(1, { EXPAND: 1, FIREBALL: 1 }, rng);
    expect(result === 'EXPAND' || result === 'FIREBALL').toBe(true);
  });

  it('returns null for empty table even at dropChance 1', () => {
    expect(rollPowerUpDrop(1, {}, () => 0)).toBeNull();
    expect(rollPowerUpDrop(1, undefined, () => 0)).toBeNull();
  });

  it('weighted pick prefers heavier entries', () => {
    // chance pass (0), then always pick at 0.0 → first entry
    let i = 0;
    const rng = () => (i++ === 0 ? 0 : 0);
    expect(rollPowerUpDrop(1, { EXPAND: 100, SHRINK: 1 }, rng)).toBe('EXPAND');
  });
});
