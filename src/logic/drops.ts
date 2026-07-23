import type { PowerUpType } from '../data/types';
import { DEFAULT_DROP_CHANCE } from '../config';

/**
 * Weighted random pick from a drop table.
 * Returns null if roll fails dropChance or table is empty.
 */
export function rollPowerUpDrop(
  dropChance: number | undefined,
  dropTable: Partial<Record<PowerUpType, number>> | undefined,
  rng: () => number = Math.random,
): PowerUpType | null {
  const chance = dropChance ?? DEFAULT_DROP_CHANCE;
  if (rng() >= chance) return null;
  if (!dropTable) return null;

  const entries = Object.entries(dropTable).filter(
    ([, w]) => typeof w === 'number' && w > 0,
  ) as [PowerUpType, number][];
  if (entries.length === 0) return null;

  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [type, w] of entries) {
    r -= w;
    if (r <= 0) return type;
  }
  return entries[entries.length - 1]![0];
}
