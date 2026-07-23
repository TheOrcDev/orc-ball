/**
 * Phaser Arcade group-vs-sprite colliders call the callback as
 * (sprite, groupChild) — i.e. order is swapped relative to
 * physics.add.collider(group, sprite, cb). Resolve by type.
 */

export function resolvePair<A, B>(
  obj1: unknown,
  obj2: unknown,
  isA: (o: unknown) => o is A,
  isB: (o: unknown) => o is B,
): { a: A; b: B } | null {
  if (isA(obj1) && isB(obj2)) return { a: obj1, b: obj2 };
  if (isA(obj2) && isB(obj1)) return { a: obj2, b: obj1 };
  return null;
}
