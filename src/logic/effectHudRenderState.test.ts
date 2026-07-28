import { describe, expect, it } from 'vitest';
import {
  buildEffectHudRenderState,
  createEmptyEffectSnapshot,
  diffEffectHudRenderState,
  hasLiveHudEffect,
  isEffectSnapshot,
  type EffectSnapshot,
} from './effectHudRenderState';

const snapshot = (
  overrides: Partial<EffectSnapshot> = {},
): EffectSnapshot => ({
  ...createEmptyEffectSnapshot(),
  ...overrides,
});

describe('buildEffectHudRenderState', () => {
  it('builds active lines in stable order with cached display properties', () => {
    const state = buildEffectHudRenderState(
      snapshot({
        glue: true,
        glueExpires: 13_500,
        laser: true,
        laserExpires: 3_500,
      }),
      1_000,
    );

    expect(state).toEqual([
      {
        label: 'GLUE',
        displayedSeconds: 13,
        color: '#26a69a',
        alpha: 1,
      },
      {
        label: 'LASER',
        displayedSeconds: 3,
        color: '#ff5252',
        alpha: 0.28,
      },
    ]);
  });

  it('omits inactive and expired lines', () => {
    const state = buildEffectHudRenderState(
      snapshot({
        glue: true,
        glueExpires: 1_000,
        bullet: false,
        bulletExpires: 20_000,
      }),
      1_000,
    );

    expect(state).toEqual([]);
    expect(hasLiveHudEffect(snapshot({ glue: true, glueExpires: 1_000 }), 1_000))
      .toBe(false);
  });
});

describe('diffEffectHudRenderState', () => {
  it('emits all properties when a line first becomes visible', () => {
    const next = buildEffectHudRenderState(
      snapshot({ glue: true, glueExpires: 12_000 }),
      1_000,
    );

    expect(diffEffectHudRenderState([], next)).toEqual([
      {
        index: 0,
        text: 'GLUE 11s',
        color: '#26a69a',
        alpha: 1,
        visible: true,
      },
    ]);
  });

  it('emits no patch across steady frames in the same displayed second', () => {
    const effects = snapshot({ glue: true, glueExpires: 12_000 });
    const previous = buildEffectHudRenderState(effects, 1_000);
    const next = buildEffectHudRenderState(effects, 1_500);

    expect(diffEffectHudRenderState(previous, next)).toEqual([]);
  });

  it('patches text only when the displayed second rolls over', () => {
    const effects = snapshot({ glue: true, glueExpires: 12_000 });
    const previous = buildEffectHudRenderState(effects, 1_000);
    const next = buildEffectHudRenderState(effects, 2_001);

    expect(diffEffectHudRenderState(previous, next)).toEqual([
      { index: 0, text: 'GLUE 10s' },
    ]);
  });

  it('patches alpha only when the expiry blink changes phase', () => {
    const effects = snapshot({ glue: true, glueExpires: 3_000 });
    const previous = buildEffectHudRenderState(effects, 0);
    const next = buildEffectHudRenderState(effects, 180);

    expect(diffEffectHudRenderState(previous, next)).toEqual([
      { index: 0, alpha: 0.28 },
    ]);
  });

  it('updates shifted label and color once, then hides the spare line', () => {
    const effects = snapshot({
      glue: true,
      glueExpires: 12_000,
      bullet: true,
      bulletExpires: 12_000,
    });
    const previous = buildEffectHudRenderState(effects, 1_000);
    const next = buildEffectHudRenderState(
      snapshot({ bullet: true, bulletExpires: 12_000 }),
      1_000,
    );

    expect(diffEffectHudRenderState(previous, next)).toEqual([
      {
        index: 0,
        text: 'BULLET 11s',
        color: '#ff7043',
      },
      { index: 1, visible: false },
    ]);
  });
});

describe('isEffectSnapshot', () => {
  it('creates a complete inactive snapshot for scene startup and reset', () => {
    expect(createEmptyEffectSnapshot()).toEqual(snapshot());
  });

  it('accepts only the complete registry snapshot shape', () => {
    expect(isEffectSnapshot(snapshot())).toBe(true);
    expect(isEffectSnapshot({ glue: false })).toBe(false);
    expect(isEffectSnapshot({ ...snapshot(), glueExpires: 'later' })).toBe(
      false,
    );
    expect(isEffectSnapshot(null)).toBe(false);
  });
});
