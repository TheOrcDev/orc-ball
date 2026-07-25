import {
  isValidName,
  isValidScore,
  LEADERBOARD_TOP_N,
  sanitizeName,
  type RankedEntry,
} from '../logic/leaderboardRules';

export type LeaderboardListResponse = {
  entries: RankedEntry[];
  error?: string;
};

export type LeaderboardSubmitResponse = {
  ok?: boolean;
  rank?: number;
  entry?: RankedEntry;
  entries?: RankedEntry[];
  error?: string;
};

const API_PATH = '/api/leaderboard';

export async function fetchLeaderboard(): Promise<LeaderboardListResponse> {
  try {
    const res = await fetch(API_PATH, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const data = (await res.json()) as LeaderboardListResponse;
    if (!res.ok) {
      return {
        entries: Array.isArray(data.entries) ? data.entries : [],
        error: data.error ?? `HTTP ${res.status}`,
      };
    }
    return {
      entries: Array.isArray(data.entries) ? data.entries.slice(0, LEADERBOARD_TOP_N) : [],
    };
  } catch {
    return { entries: [], error: 'Network error' };
  }
}

export async function submitScore(
  rawName: string,
  score: number,
): Promise<LeaderboardSubmitResponse> {
  const name = sanitizeName(rawName);
  if (!isValidName(name)) return { error: 'Invalid name' };
  if (!isValidScore(score)) return { error: 'Invalid score' };

  try {
    const res = await fetch(API_PATH, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, score }),
    });
    const data = (await res.json()) as LeaderboardSubmitResponse;
    if (!res.ok) {
      return { error: data.error ?? `HTTP ${res.status}` };
    }
    return data;
  } catch {
    return { error: 'Network error' };
  }
}
