import { describe, expect, it } from 'vitest';
import { HIGH_SCORE_KEY } from '../config';
import { levelCount } from '../data/levels';
import {
  canContinue,
  clearRunKeepUnlocks,
  defaultProgress,
  loadProgress,
  migrateLegacyHighScore,
  parseProgress,
  PROGRESS_KEY,
  saveGameOver,
  saveLevelCleared,
  saveProgress,
  saveRun,
} from './ProgressSave';

function memStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    key: (i: number) => [...map.keys()][i] ?? null,
  } as Storage;
}

describe('parseProgress', () => {
  it('returns defaults for null/invalid', () => {
    expect(parseProgress(null).highScore).toBe(0);
    expect(parseProgress('not-json').run).toBeNull();
  });

  it('parses a valid run', () => {
    const p = parseProgress(
      JSON.stringify({
        version: 1,
        highScore: 900,
        highestLevel: 3,
        run: { level: 2, score: 400, lives: 2 },
        updatedAt: 1,
      }),
    );
    expect(p.highScore).toBe(900);
    expect(p.highestLevel).toBe(3);
    expect(p.run).toEqual({ level: 2, score: 400, lives: 2 });
    expect(canContinue(p)).toBe(true);
  });

  it('rejects run with 0 lives', () => {
    const p = parseProgress(
      JSON.stringify({
        highScore: 10,
        highestLevel: 1,
        run: { level: 1, score: 10, lives: 0 },
      }),
    );
    expect(p.run).toBeNull();
    expect(canContinue(p)).toBe(false);
  });

  it('clamps highestLevel to campaign size', () => {
    const p = parseProgress(
      JSON.stringify({ highScore: 0, highestLevel: 9999, run: null }),
    );
    expect(p.highestLevel).toBe(levelCount() - 1);
  });
});

describe('migrateLegacyHighScore', () => {
  it('reads old high score key', () => {
    expect(migrateLegacyHighScore('1500')).toBe(1500);
    expect(migrateLegacyHighScore(null)).toBe(0);
  });
});

describe('load/save progress', () => {
  it('persists and reloads a run', () => {
    const store = memStorage();
    saveProgress(
      {
        version: 1,
        highScore: 100,
        highestLevel: 1,
        run: { level: 1, score: 50, lives: 3 },
        updatedAt: 0,
      },
      store,
    );
    const loaded = loadProgress(store);
    expect(loaded.highScore).toBe(100);
    expect(loaded.run?.level).toBe(1);
    expect(store.getItem(HIGH_SCORE_KEY)).toBe('100');
    expect(store.getItem(PROGRESS_KEY)).toBeTruthy();
  });

  it('merges legacy high score on load', () => {
    const store = memStorage({ [HIGH_SCORE_KEY]: '5000' });
    const p = loadProgress(store);
    expect(p.highScore).toBe(5000);
  });
});

describe('saveRun / saveLevelCleared / saveGameOver', () => {
  it('saveRun stores continue checkpoint', () => {
    const store = memStorage();
    const p = saveRun(4, 1200, 2, store);
    expect(p.run).toEqual({ level: 4, score: 1200, lives: 2 });
    expect(p.highestLevel).toBeGreaterThanOrEqual(4);
    expect(canContinue(p)).toBe(true);
  });

  it('level clear advances continue to next level', () => {
    const store = memStorage();
    const p = saveLevelCleared(0, 300, 2, store);
    expect(p.run?.level).toBe(1);
    expect(p.run?.score).toBe(300);
    expect(p.highScore).toBe(300);
  });

  it('final level clear clears the run', () => {
    const store = memStorage();
    const last = levelCount() - 1;
    const p = saveLevelCleared(last, 9999, 1, store);
    expect(p.run).toBeNull();
    expect(p.highScore).toBe(9999);
  });

  it('game over clears continue but keeps high score', () => {
    const store = memStorage();
    saveRun(3, 500, 1, store);
    const p = saveGameOver(800, 3, store);
    expect(p.run).toBeNull();
    expect(p.highScore).toBe(800);
    expect(p.highestLevel).toBeGreaterThanOrEqual(3);
  });

  it('clearRunKeepUnlocks drops continue only', () => {
    const store = memStorage();
    saveRun(2, 400, 3, store);
    const p = clearRunKeepUnlocks(store);
    expect(p.run).toBeNull();
    expect(p.highestLevel).toBeGreaterThanOrEqual(2);
  });
});

describe('canContinue', () => {
  it('false on default progress', () => {
    expect(canContinue(defaultProgress())).toBe(false);
  });
});
