import { describe, expect, it } from 'vitest';
import {
  advanceFxRedrawClock,
  isFxRedrawDue,
  shouldReconfigureParticleStyle,
} from './fxCadence';

describe('FX redraw cadence', () => {
  it('holds redraws until the interval is reached', () => {
    let elapsed = advanceFxRedrawClock(0, 16, 50);
    expect(isFxRedrawDue(elapsed, 50)).toBe(false);

    elapsed = advanceFxRedrawClock(elapsed, 16, 50);
    expect(isFxRedrawDue(elapsed, 50)).toBe(false);

    elapsed = advanceFxRedrawClock(elapsed, 18, 50);
    expect(isFxRedrawDue(elapsed, 50)).toBe(true);
  });

  it('caps long-frame backlog at one redraw and ignores negative deltas', () => {
    expect(advanceFxRedrawClock(12, 500, 50)).toBe(50);
    expect(advanceFxRedrawClock(12, -20, 50)).toBe(12);
  });

  it('treats a disabled interval as immediately due', () => {
    expect(advanceFxRedrawClock(0, 16, 0)).toBe(0);
    expect(isFxRedrawDue(0, 0)).toBe(true);
  });

  it('only rebuilds particle processors across rendering styles', () => {
    expect(
      shouldReconfigureParticleStyle('electric', 'electric'),
    ).toBe(false);
    expect(shouldReconfigureParticleStyle('glue', 'glue')).toBe(false);
    expect(shouldReconfigureParticleStyle('electric', 'glue')).toBe(true);
    expect(shouldReconfigureParticleStyle('glue', 'electric')).toBe(true);
  });
});
