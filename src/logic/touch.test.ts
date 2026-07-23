import { describe, expect, it } from 'vitest';
import {
  clampPaddleX,
  clientXToGameX,
  clientYToGameY,
  isClientInCanvas,
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

describe('clientXToGameX / clientYToGameY', () => {
  const rect = { left: 100, top: 200, width: 400, height: 300 };

  it('maps canvas left/right edges to world 0 / width', () => {
    expect(clientXToGameX(100, rect, 800)).toBe(0);
    expect(clientXToGameX(500, rect, 800)).toBe(800);
    expect(clientXToGameX(300, rect, 800)).toBe(400);
  });

  it('maps X even when the finger is below the canvas (letterbox)', () => {
    // Same X as canvas center, but Y is in the black bar under the game
    expect(clientXToGameX(300, rect, 800)).toBe(400);
  });

  it('clamps X outside the canvas horizontal span', () => {
    expect(clientXToGameX(50, rect, 800)).toBe(0);
    expect(clientXToGameX(600, rect, 800)).toBe(800);
  });

  it('maps canvas top/bottom edges to world 0 / height', () => {
    expect(clientYToGameY(200, rect, 600)).toBe(0);
    expect(clientYToGameY(500, rect, 600)).toBe(600);
  });
});

describe('isClientInCanvas', () => {
  const rect = { left: 100, top: 200, width: 400, height: 300 };

  it('true inside canvas', () => {
    expect(isClientInCanvas(300, 350, rect)).toBe(true);
  });

  it('false in letterbox below canvas', () => {
    expect(isClientInCanvas(300, 550, rect)).toBe(false);
  });
});
