import { describe, expect, it } from 'vitest';
import {
  clampPaddleX,
  isTapGesture,
  prefersTouchUi,
  TAP_MAX_DIST,
  TAP_MAX_MS,
} from './touch';

describe('prefersTouchUi', () => {
  it('true for touch-capable devices', () => {
    expect(
      prefersTouchUi({
        maxTouchPoints: 5,
        coarsePointer: false,
        innerWidth: 1200,
        innerHeight: 800,
      }),
    ).toBe(true);
  });

  it('true for coarse pointer', () => {
    expect(
      prefersTouchUi({
        maxTouchPoints: 0,
        coarsePointer: true,
        innerWidth: 1200,
        innerHeight: 800,
      }),
    ).toBe(true);
  });

  it('true for small screens even without touch', () => {
    expect(
      prefersTouchUi({
        maxTouchPoints: 0,
        coarsePointer: false,
        innerWidth: 390,
        innerHeight: 844,
      }),
    ).toBe(true);
  });

  it('false for large desktop without touch', () => {
    expect(
      prefersTouchUi({
        maxTouchPoints: 0,
        coarsePointer: false,
        innerWidth: 1440,
        innerHeight: 900,
      }),
    ).toBe(false);
  });
});

describe('isTapGesture', () => {
  it('accepts short stationary press', () => {
    expect(isTapGesture(100, 100, 102, 101, 120)).toBe(true);
  });

  it('rejects long press', () => {
    expect(isTapGesture(100, 100, 100, 100, TAP_MAX_MS + 1)).toBe(false);
  });

  it('rejects drag beyond max distance', () => {
    expect(isTapGesture(100, 100, 100 + TAP_MAX_DIST + 5, 100, 100)).toBe(
      false,
    );
  });
});

describe('clampPaddleX', () => {
  it('clamps to paddle half-width inside world', () => {
    expect(clampPaddleX(0, 60, 800)).toBe(60);
    expect(clampPaddleX(800, 60, 800)).toBe(740);
    expect(clampPaddleX(400, 60, 800)).toBe(400);
  });
});
