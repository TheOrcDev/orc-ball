import { describe, expect, it } from 'vitest';
import {
  getFxTheme,
  resolveFxThemeId,
  type ActiveFxFlags,
} from './fxTheme';

const none: ActiveFxFlags = {
  sticky: false,
  fireball: false,
  expand: false,
  shrink: false,
};

describe('resolveFxThemeId', () => {
  it('defaults to arc field', () => {
    expect(resolveFxThemeId(none)).toBe('default');
  });

  it('prioritizes bullet over glue and expand', () => {
    expect(
      resolveFxThemeId({
        ...none,
        fireball: true,
        sticky: true,
        expand: true,
      }),
    ).toBe('bullet');
  });

  it('prioritizes glue over expand', () => {
    expect(
      resolveFxThemeId({ ...none, sticky: true, expand: true }),
    ).toBe('glue');
  });

  it('maps expand / shrink / multi', () => {
    expect(resolveFxThemeId({ ...none, expand: true })).toBe('expand');
    expect(resolveFxThemeId({ ...none, shrink: true })).toBe('shrink');
    expect(resolveFxThemeId({ ...none, multiPulse: true })).toBe('multi');
  });
});

describe('getFxTheme', () => {
  it('returns distinct palettes per power', () => {
    const def = getFxTheme(none);
    const bullet = getFxTheme({ ...none, fireball: true });
    const glue = getFxTheme({ ...none, sticky: true });
    expect(def.primary).not.toBe(bullet.primary);
    expect(glue.primary).not.toBe(bullet.primary);
    expect(bullet.label).toBe('BULLET');
    expect(glue.label).toBe('GLUE');
  });

  it('bullet theme is more intense than default', () => {
    const def = getFxTheme(none);
    const bullet = getFxTheme({ ...none, fireball: true });
    expect(bullet.wallIntensity).toBeGreaterThan(def.wallIntensity);
    expect(bullet.boltFrequencyMs).toBeLessThan(def.boltFrequencyMs);
  });
});
