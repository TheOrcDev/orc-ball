import { HIGH_SCORE_KEY, START_LIVES } from '../config';
import { levelCount } from '../data/levels';

/**
 * Campaign progress in localStorage (preferred over cookies for size/reliability).
 * Same origin persistence as the high-score key already used.
 */
export const PROGRESS_KEY = 'orc-ball-progress';

export interface RunProgress {
  /** 0-based level index to resume */
  level: number;
  score: number;
  lives: number;
}

export interface ProgressData {
  version: 1;
  highScore: number;
  /** Highest 0-based level index the player has reached. */
  highestLevel: number;
  /** In-progress run; null if no continue available. */
  run: RunProgress | null;
  updatedAt: number;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function defaultProgress(): ProgressData {
  return {
    version: 1,
    highScore: 0,
    highestLevel: 0,
    run: null,
    updatedAt: 0,
  };
}

export function migrateLegacyHighScore(rawHigh: string | null): number {
  if (!rawHigh) return 0;
  const n = parseInt(rawHigh, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function parseProgress(json: string | null): ProgressData {
  const base = defaultProgress();
  if (!json) return base;
  try {
    const data = JSON.parse(json) as Partial<ProgressData>;
    const highScore =
      typeof data.highScore === 'number' && data.highScore >= 0
        ? Math.floor(data.highScore)
        : 0;
    const maxIdx = Math.max(0, levelCount() - 1);
    const highestLevel = Math.min(
      maxIdx,
      Math.max(
        0,
        typeof data.highestLevel === 'number'
          ? Math.floor(data.highestLevel)
          : 0,
      ),
    );
    let run: RunProgress | null = null;
    if (data.run && typeof data.run === 'object') {
      const level = Math.floor(Number(data.run.level));
      const score = Math.floor(Number(data.run.score));
      const lives = Math.floor(Number(data.run.lives));
      if (
        Number.isFinite(level) &&
        level >= 0 &&
        level < levelCount() &&
        Number.isFinite(score) &&
        score >= 0 &&
        Number.isFinite(lives) &&
        lives > 0
      ) {
        run = { level, score, lives };
      }
    }
    return {
      version: 1,
      highScore,
      highestLevel,
      run,
      updatedAt:
        typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
    };
  } catch {
    return base;
  }
}

export function loadProgress(storage: Store = localStorage): ProgressData {
  try {
    const parsed = parseProgress(storage.getItem(PROGRESS_KEY));
    const legacy = migrateLegacyHighScore(storage.getItem(HIGH_SCORE_KEY));
    if (legacy > parsed.highScore) {
      parsed.highScore = legacy;
    }
    return parsed;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(
  data: ProgressData,
  storage: Store = localStorage,
): void {
  const payload: ProgressData = {
    ...data,
    version: 1,
    updatedAt: Date.now(),
  };
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(payload));
    storage.setItem(HIGH_SCORE_KEY, String(payload.highScore));
  } catch {
    // private mode / quota
  }
}

export function updateHighScore(
  score: number,
  storage: Store = localStorage,
): ProgressData {
  const p = loadProgress(storage);
  if (score > p.highScore) {
    p.highScore = score;
    saveProgress(p, storage);
  }
  return p;
}

/** Save mid-run so Continue works (pause → menu, level mid-play). */
export function saveRun(
  level: number,
  score: number,
  lives: number,
  storage: Store = localStorage,
): ProgressData {
  const p = loadProgress(storage);
  if (score > p.highScore) p.highScore = score;
  p.highestLevel = Math.max(p.highestLevel, level);
  p.run =
    lives > 0 && level >= 0 && level < levelCount()
      ? { level, score, lives }
      : null;
  saveProgress(p, storage);
  return p;
}

/** Level cleared — unlock next and park continue on next level. */
export function saveLevelCleared(
  clearedLevel: number,
  score: number,
  lives: number,
  storage: Store = localStorage,
): ProgressData {
  const p = loadProgress(storage);
  if (score > p.highScore) p.highScore = score;
  const next = clearedLevel + 1;
  p.highestLevel = Math.max(
    p.highestLevel,
    Math.min(Math.max(clearedLevel, next - 1), levelCount() - 1),
  );
  if (next < levelCount() && lives > 0) {
    p.highestLevel = Math.max(p.highestLevel, next);
    p.run = { level: next, score, lives };
  } else {
    p.run = null;
    p.highestLevel = Math.max(p.highestLevel, levelCount() - 1);
  }
  saveProgress(p, storage);
  return p;
}

/** Game over — clear continue run, keep high score / unlocks. */
export function saveGameOver(
  score: number,
  levelReached: number,
  storage: Store = localStorage,
): ProgressData {
  const p = loadProgress(storage);
  if (score > p.highScore) p.highScore = score;
  p.highestLevel = Math.max(p.highestLevel, levelReached);
  p.run = null;
  saveProgress(p, storage);
  return p;
}

/** Clear continue but keep unlocks / high score. */
export function clearRunKeepUnlocks(
  storage: Store = localStorage,
): ProgressData {
  const p = loadProgress(storage);
  p.run = null;
  saveProgress(p, storage);
  return p;
}

export function canContinue(p: ProgressData = loadProgress()): boolean {
  return p.run !== null && p.run.lives > 0;
}

export function freshRun(): RunProgress {
  return { level: 0, score: 0, lives: START_LIVES };
}
