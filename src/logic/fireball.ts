/**
 * Fireball processCallback decision for ball↔brick collider.
 * Returning false skips the physical collision (pass-through) after
 * the caller has destroyed the brick inline.
 *
 * true  → run normal arcade collision (normal ball)
 * false → skip collision (fireball pass-through)
 */
export function shouldProcessBallBrickCollision(isFireball: boolean): boolean {
  return !isFireball;
}

/** Whether a brick can be damaged by this ball. */
export function canDamageBrick(
  isFireball: boolean,
  isIndestructible: boolean,
): boolean {
  if (isIndestructible) return isFireball;
  return true;
}
