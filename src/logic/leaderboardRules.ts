/** Shared leaderboard validation (client + API). */

export const LEADERBOARD_TOP_N = 20;
/** Keep a bit more than the public top so near-misses can climb later. */
export const LEADERBOARD_STORE_CAP = 100;
export const LEADERBOARD_NAME_MAX = 12;
export const LEADERBOARD_NAME_MIN = 1;
/** Hard cap against absurd client-side scores. */
export const LEADERBOARD_SCORE_MAX = 10_000_000;
export const LEADERBOARD_SCORE_MIN = 1;

export type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  /** Unix ms when submitted. */
  at: number;
};

export type RankedEntry = LeaderboardEntry & { rank: number };

const NAME_ALLOWED = /^[A-Za-z0-9 _.\-]+$/;

/** Trim, collapse spaces, strip disallowed chars, clamp length. */
export function sanitizeName(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[^\w .\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LEADERBOARD_NAME_MAX);
}

export function isValidName(name: string): boolean {
  if (name.length < LEADERBOARD_NAME_MIN || name.length > LEADERBOARD_NAME_MAX) {
    return false;
  }
  return NAME_ALLOWED.test(name);
}

export function isValidScore(score: number): boolean {
  return (
    Number.isInteger(score) &&
    score >= LEADERBOARD_SCORE_MIN &&
    score <= LEADERBOARD_SCORE_MAX
  );
}

/** Higher score first; earlier submit wins ties. */
export function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.at - b.at;
}

export function rankEntries(entries: LeaderboardEntry[]): RankedEntry[] {
  return [...entries]
    .sort(compareEntries)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

export function topN(
  entries: LeaderboardEntry[],
  n = LEADERBOARD_TOP_N,
): RankedEntry[] {
  return rankEntries(entries).slice(0, n);
}

/**
 * Insert a new score, re-sort, cap storage size.
 * Returns the updated full list and the new entry's rank (1-based).
 */
export function insertScore(
  existing: LeaderboardEntry[],
  entry: LeaderboardEntry,
): { entries: LeaderboardEntry[]; rank: number } {
  const merged = [...existing, entry].sort(compareEntries);
  const rank = merged.findIndex((e) => e.id === entry.id) + 1;
  const entries = merged.slice(0, LEADERBOARD_STORE_CAP);
  return { entries, rank };
}
