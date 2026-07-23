import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PADDLE_HEIGHT,
  PADDLE_SCALE_EXPAND,
  PADDLE_SCALE_NORMAL,
  PADDLE_SCALE_SHRINK,
  PADDLE_WIDTH,
} from '../config';
import {
  paddleBodyMatchesDisplay,
  paddleBodySetSizeArgs,
  paddleBodyWorldSize,
} from './paddleBody';

describe('paddleBody setSize (Phaser scale multiply)', () => {
  it('setSize args are unscaled frame size, not display size', () => {
    const args = paddleBodySetSizeArgs(PADDLE_WIDTH, PADDLE_HEIGHT);
    expect(args).toEqual({ width: PADDLE_WIDTH, height: PADDLE_HEIGHT });
    // Must NOT be display-sized for expand/shrink
    expect(args.width).not.toBe(PADDLE_WIDTH * PADDLE_SCALE_EXPAND);
    expect(args.width).not.toBe(PADDLE_WIDTH * PADDLE_SCALE_SHRINK);
  });

  it('world body width matches displayWidth at shrink / normal / expand', () => {
    for (const scale of [
      PADDLE_SCALE_SHRINK,
      PADDLE_SCALE_NORMAL,
      PADDLE_SCALE_EXPAND,
    ]) {
      const r = paddleBodyMatchesDisplay(PADDLE_WIDTH, PADDLE_HEIGHT, scale);
      expect(r.match).toBe(true);
      expect(r.bodyWidth).toBeCloseTo(r.displayWidth, 10);
      expect(r.bodyHeight).toBeCloseTo(r.displayHeight, 10);
      expect(r.bodyWidth).toBeCloseTo(PADDLE_WIDTH * scale, 10);
    }
  });

  it('wrong path (passing displayWidth into setSize) double-scales', () => {
    // Documents the bug: if you pass displayWidth, Phaser multiplies by scale again
    const scale = PADDLE_SCALE_EXPAND;
    const wrongSource = PADDLE_WIDTH * scale; // displayWidth mistakenly passed
    const wrongWorld = paddleBodyWorldSize(wrongSource, PADDLE_HEIGHT * scale, scale, scale);
    expect(wrongWorld.width).toBeCloseTo(PADDLE_WIDTH * scale * scale, 10); // 270 ≠ 180
    expect(wrongWorld.width).not.toBeCloseTo(PADDLE_WIDTH * scale, 10);
  });
});

describe('Paddle.syncBodySize shipped implementation', () => {
  const paddleSrc = readFileSync(
    join(import.meta.dirname, '../objects/Paddle.ts'),
    'utf8',
  );

  it('wires paddleBodySetSizeArgs(this.width, this.height) into body.setSize', () => {
    expect(paddleSrc).toMatch(/paddleBodySetSizeArgs/);
    expect(paddleSrc).toMatch(
      /paddleBodySetSizeArgs\(\s*this\.width\s*,\s*this\.height\s*\)/,
    );
    expect(paddleSrc).toMatch(/body\.setSize\(\s*width\s*,\s*height/);
  });

  it('does not pass displayWidth/displayHeight into setSize call', () => {
    const m = paddleSrc.match(
      /syncBodySize\(\):\s*void\s*\{([\s\S]*?)\n  \}/,
    );
    expect(m).toBeTruthy();
    const methodBody = m![1]!;
    expect(methodBody).toContain('paddleBodySetSizeArgs');
    expect(methodBody).toContain('body.setSize');
    expect(methodBody).not.toMatch(/this\.displayWidth/);
    expect(methodBody).not.toMatch(/this\.displayHeight/);
  });
});
