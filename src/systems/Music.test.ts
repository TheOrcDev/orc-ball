import { describe, expect, it } from 'vitest';
import {
  DEFERRED_TRACK_ASSETS,
  GAMEPLAY_TRACKS,
  MENU_TRACK_ASSETS,
  MENU_TRACKS,
  Music,
  MUSIC_COIN_OP,
  MUSIC_DANGER,
  MUSIC_LEVEL_CLEAR,
  MUSIC_TRACK_ASSETS,
} from './Music';

describe('Music.trackKeyForLevel', () => {
  it('rotates through gameplay tracks by level index', () => {
    for (const [index, track] of GAMEPLAY_TRACKS.entries()) {
      expect(Music.trackKeyForLevel(index)).toBe(track);
    }
    expect(Music.trackKeyForLevel(GAMEPLAY_TRACKS.length)).toBe(
      GAMEPLAY_TRACKS[0],
    );
  });

  it('uses all dedicated gameplay tracks without consuming the danger cue', () => {
    expect(GAMEPLAY_TRACKS).toContain(MUSIC_COIN_OP);
    expect(GAMEPLAY_TRACKS).not.toContain(MUSIC_DANGER);
    expect(GAMEPLAY_TRACKS).toHaveLength(11);
    expect(new Set(GAMEPLAY_TRACKS).size).toBe(GAMEPLAY_TRACKS.length);
  });

  it('handles negative indices safely', () => {
    expect(Music.trackKeyForLevel(-1)).toBe(
      GAMEPLAY_TRACKS[GAMEPLAY_TRACKS.length - 1],
    );
  });
});

describe('Music.trackKeyForMenuVisit', () => {
  it('rotates through all four title-screen loops', () => {
    for (const [index, track] of MENU_TRACKS.entries()) {
      expect(Music.trackKeyForMenuVisit(index)).toBe(track);
    }
    expect(Music.trackKeyForMenuVisit(MENU_TRACKS.length)).toBe(
      MENU_TRACKS[0],
    );
  });

  it('handles negative visit indices safely', () => {
    expect(Music.trackKeyForMenuVisit(-1)).toBe(
      MENU_TRACKS[MENU_TRACKS.length - 1],
    );
  });
});

describe('MUSIC_TRACK_ASSETS', () => {
  it('has one unique preload asset for every soundtrack key', () => {
    const assetKeys = MUSIC_TRACK_ASSETS.map(([key]) => key);
    expect(new Set(assetKeys).size).toBe(assetKeys.length);
    expect(assetKeys).toEqual(
      expect.arrayContaining([
        ...GAMEPLAY_TRACKS,
        ...MENU_TRACKS,
        MUSIC_DANGER,
        MUSIC_LEVEL_CLEAR,
      ]),
    );
  });

  it('splits menu boot assets from deferred gameplay assets', () => {
    expect(MENU_TRACK_ASSETS.map(([k]) => k)).toEqual([...MENU_TRACKS]);
    expect(DEFERRED_TRACK_ASSETS.map(([k]) => k)).toEqual(
      expect.arrayContaining([...GAMEPLAY_TRACKS, MUSIC_DANGER, MUSIC_LEVEL_CLEAR]),
    );
    expect(DEFERRED_TRACK_ASSETS).toHaveLength(
      MUSIC_TRACK_ASSETS.length - MENU_TRACK_ASSETS.length,
    );
  });
});

describe('Music disabled level transitions', () => {
  it('starts the newly selected level track after music is re-enabled', () => {
    type MockSound = {
      isPlaying: boolean;
      isPaused: boolean;
      resumeCount: number;
      pause: () => void;
      resume: () => void;
      setVolume: () => void;
    };

    const sounds = new Map<string, MockSound>();
    const playCalls: string[] = [];
    const scene = {
      cache: {
        audio: {
          exists: () => true,
        },
      },
      sound: {
        get: (key: string) => sounds.get(key) ?? null,
        play: (key: string) => {
          const sound: MockSound = {
            isPlaying: true,
            isPaused: false,
            resumeCount: 0,
            pause() {
              this.isPlaying = false;
              this.isPaused = true;
            },
            resume() {
              this.resumeCount += 1;
              this.isPlaying = true;
              this.isPaused = false;
            },
            setVolume() {},
          };
          sounds.set(key, sound);
          playCalls.push(key);
        },
        stopByKey: (key: string) => {
          const sound = sounds.get(key);
          if (sound) {
            sound.isPlaying = false;
            sound.isPaused = false;
          }
        },
      },
    } as unknown as Parameters<typeof Music.playForLevel>[0];

    Music.setEnabled(true);
    Music.setVolumePercent(100);
    Music.stop(scene);
    Music.playForLevel(scene, 0);
    const firstTrack = GAMEPLAY_TRACKS[0];
    const firstSound = sounds.get(firstTrack)!;

    Music.setEnabled(false, scene);
    expect(firstSound.isPaused).toBe(true);
    Music.playForLevel(scene, 1);
    expect(Music.activeKey).toBeNull();

    Music.setEnabled(true, scene);
    expect(playCalls.at(-1)).toBe(GAMEPLAY_TRACKS[1]);
    expect(firstSound.resumeCount).toBe(0);

    Music.stop(scene);
  });
});
