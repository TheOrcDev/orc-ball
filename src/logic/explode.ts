/**
 * Cross blast helpers: center brick + orthogonal neighbors (up/down/left/right).
 */

export type GridCell = { col: number; row: number };

/** True when B is directly above / below / left / right of A (no diagonals). */
export function isOrthogonalNeighbor(
  a: GridCell,
  b: GridCell,
): boolean {
  const dc = Math.abs(a.col - b.col);
  const dr = Math.abs(a.row - b.row);
  return (dc === 1 && dr === 0) || (dc === 0 && dr === 1);
}

/** Filter bricks that sit on the four orthogonal cells around `center`. */
export function orthogonalNeighbors<T extends GridCell>(
  center: GridCell,
  candidates: readonly T[],
): T[] {
  return candidates.filter((c) => isOrthogonalNeighbor(center, c));
}

/** The four offset cells around a center (may be off-grid). */
export function crossOffsets(): readonly GridCell[] {
  return [
    { col: 0, row: -1 },
    { col: 0, row: 1 },
    { col: -1, row: 0 },
    { col: 1, row: 0 },
  ];
}
