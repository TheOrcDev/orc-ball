import { describe, expect, it } from 'vitest';
import {
  GAMEPLAY_TRACKS,
  Music,
  MUSIC_COIN_OP,
  MUSIC_DANGER,
} from './Music';

describe('Music.trackKeyForLevel', () => {
  it('rotates through gameplay tracks by level index', () => {
    expect(Music.trackKeyForLevel(0)).toBe(GAMEPLAY_TRACKS[0]);
    expect(Music.trackKeyForLevel(1)).toBe(GAMEPLAY_TRACKS[1]);
    expect(Music.trackKeyForLevel(2)).toBe(GAMEPLAY_TRACKS[0]);
  });

  it('uses both level tracks', () => {
    expect(GAMEPLAY_TRACKS).toContain(MUSIC_COIN_OP);
    expect(GAMEPLAY_TRACKS).toContain(MUSIC_DANGER);
    expect(GAMEPLAY_TRACKS).toHaveLength(2);
    expect(new Set(GAMEPLAY_TRACKS).size).toBe(GAMEPLAY_TRACKS.length);
  });

  it('handles negative indices safely', () => {
    expect(Music.trackKeyForLevel(-1)).toBe(
      GAMEPLAY_TRACKS[GAMEPLAY_TRACKS.length - 1],
    );
  });
});
