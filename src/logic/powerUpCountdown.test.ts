import { describe, expect, it } from 'vitest';
import {
  buildEffectsHud,
  expiryBlinkAlpha,
  expiryBlinkPeriodMs,
  formatSecondsLeft,
  isExpiringSoon,
  remainingMs,
} from './powerUpCountdown';

describe('remainingMs', () => {
  it('returns 0 when missing or past', () => {
    expect(remainingMs(undefined, 1000)).toBe(0);
    expect(remainingMs(500, 1000)).toBe(0);
  });

  it('returns time left', () => {
    expect(remainingMs(5000, 2000)).toBe(3000);
  });
});

describe('isExpiringSoon', () => {
  it('true only inside warn window while still active', () => {
    expect(isExpiringSoon(3000, 3000)).toBe(true);
    expect(isExpiringSoon(2999, 3000)).toBe(true);
    expect(isExpiringSoon(3001, 3000)).toBe(false);
    expect(isExpiringSoon(0, 3000)).toBe(false);
  });
});

describe('expiryBlinkPeriodMs', () => {
  it('speeds up near zero', () => {
    const base = 180;
    expect(expiryBlinkPeriodMs(2500, base)).toBe(base);
    expect(expiryBlinkPeriodMs(1500, base)).toBeLessThan(base);
    expect(expiryBlinkPeriodMs(500, base)).toBeLessThan(
      expiryBlinkPeriodMs(1500, base),
    );
  });
});

describe('expiryBlinkAlpha', () => {
  it('stays solid outside warning window', () => {
    expect(expiryBlinkAlpha(0, 5000, 180)).toBe(1);
    expect(expiryBlinkAlpha(180, 5000, 180)).toBe(1);
  });

  it('alternates while warning', () => {
    expect(expiryBlinkAlpha(0, 2000, 180)).toBe(1);
    expect(expiryBlinkAlpha(180, 2000, 180)).toBe(0.28);
  });
});

describe('formatSecondsLeft', () => {
  it('ceils to whole seconds', () => {
    expect(formatSecondsLeft(3000)).toBe('3s');
    expect(formatSecondsLeft(3001)).toBe('4s');
    expect(formatSecondsLeft(1)).toBe('1s');
    expect(formatSecondsLeft(0)).toBe('0s');
  });
});

describe('buildEffectsHud', () => {
  it('stacks active effects vertically with countdowns', () => {
    const hud = buildEffectsHud([
      { label: 'GLUE', remainingMs: 12500, hint: 'launch to free' },
      { label: 'BULLET', remainingMs: 2500 },
    ]);
    expect(hud.lines).toEqual(['GLUE 13s', 'BULLET 3s']);
    expect(hud.text).toBe('GLUE 13s\nBULLET 3s');
    expect(hud.warning).toBe(true);
    expect(hud.minRemainingMs).toBe(2500);
  });

  it('empty when nothing active', () => {
    const hud = buildEffectsHud([{ label: 'GLUE', remainingMs: 0 }]);
    expect(hud.text).toBe('');
    expect(hud.lines).toEqual([]);
    expect(hud.warning).toBe(false);
  });
});
