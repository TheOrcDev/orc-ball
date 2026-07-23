import { describe, expect, it } from 'vitest';
import { resolvePair } from './collidePair';

class BallLike {
  kind = 'ball' as const;
}
class PaddleLike {
  kind = 'paddle' as const;
}

const isBall = (o: unknown): o is BallLike => o instanceof BallLike;
const isPaddle = (o: unknown): o is PaddleLike => o instanceof PaddleLike;

describe('resolvePair', () => {
  it('keeps (ball, paddle) order when already correct', () => {
    const ball = new BallLike();
    const paddle = new PaddleLike();
    const r = resolvePair(ball, paddle, isBall, isPaddle);
    expect(r).toEqual({ a: ball, b: paddle });
  });

  it('swaps Phaser group-vs-sprite order (paddle, ball) → ball first', () => {
    const ball = new BallLike();
    const paddle = new PaddleLike();
    // Phaser calls collideCallback(sprite, groupChild) for group-vs-sprite
    const r = resolvePair(paddle, ball, isBall, isPaddle);
    expect(r).not.toBeNull();
    expect(r!.a).toBe(ball);
    expect(r!.b).toBe(paddle);
  });

  it('returns null for unrelated objects', () => {
    expect(resolvePair({}, {}, isBall, isPaddle)).toBeNull();
    expect(resolvePair(new BallLike(), {}, isBall, isPaddle)).toBeNull();
  });
});
