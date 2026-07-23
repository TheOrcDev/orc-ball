import type Phaser from 'phaser';
import {
  MUSIC_ENABLED_KEY,
  MUSIC_VOLUME_DEFAULT,
  MUSIC_VOLUME_KEY,
} from '../config';

/** Phaser audio keys (loaded in BootScene from public/audio/). */
export const MUSIC_MENU = 'music-menu';
export const MUSIC_LEVEL_CLEAR = 'music-level-clear';
export const MUSIC_DANGER = 'music-danger';
export const MUSIC_COIN_OP = 'music-coin-op';
export const MUSIC_BINARY_EAGLE = 'music-binary-eagle';

/** Rotating in-game loops — a new one starts each level (by index). */
export const GAMEPLAY_TRACKS = [
  MUSIC_BINARY_EAGLE,
  MUSIC_COIN_OP,
  MUSIC_DANGER,
] as const;

const ALL_KEYS = [
  MUSIC_MENU,
  MUSIC_LEVEL_CLEAR,
  MUSIC_DANGER,
  MUSIC_COIN_OP,
  MUSIC_BINARY_EAGLE,
] as const;

type SoundWithVol = Phaser.Sound.BaseSound & {
  setVolume?: (v: number) => void;
  isPlaying?: boolean;
  isPaused?: boolean;
};

/**
 * BGM with independent on/off + volume (0–100%).
 * New level → new track from GAMEPLAY_TRACKS (cycles).
 */
export class Music {
  private static enabled = Music.loadEnabled();
  private static volPct = Music.loadVolumePercent();
  private static currentKey: string | null = null;
  private static currentLevelIndex: number | null = null;

  static get isEnabled(): boolean {
    return Music.enabled;
  }

  static get volumePercent(): number {
    return Music.volPct;
  }

  static get volume(): number {
    if (!Music.enabled) return 0;
    return Math.max(0, Math.min(1, Music.volPct / 100));
  }

  static get activeKey(): string | null {
    return Music.currentKey;
  }

  /** Which gameplay track plays for a 0-based level index. */
  static trackKeyForLevel(levelIndex: number): string {
    const i =
      ((levelIndex % GAMEPLAY_TRACKS.length) + GAMEPLAY_TRACKS.length) %
      GAMEPLAY_TRACKS.length;
    return GAMEPLAY_TRACKS[i]!;
  }

  static setEnabled(on: boolean, scene?: Phaser.Scene): void {
    Music.enabled = on;
    try {
      localStorage.setItem(MUSIC_ENABLED_KEY, on ? '1' : '0');
    } catch {
      // ignore
    }
    if (scene) Music.syncPlaying(scene);
  }

  static toggleEnabled(scene?: Phaser.Scene): boolean {
    Music.setEnabled(!Music.enabled, scene);
    return Music.enabled;
  }

  static setVolumePercent(percent: number, scene?: Phaser.Scene): void {
    const p = Math.round(Math.max(0, Math.min(100, percent)));
    Music.volPct = p;
    try {
      localStorage.setItem(MUSIC_VOLUME_KEY, String(p));
    } catch {
      // ignore
    }
    if (scene) Music.syncPlaying(scene);
  }

  static adjustVolume(delta: number, scene?: Phaser.Scene): number {
    Music.setVolumePercent(Music.volPct + delta, scene);
    return Music.volPct;
  }

  private static loadEnabled(): boolean {
    try {
      const v = localStorage.getItem(MUSIC_ENABLED_KEY);
      if (v === null) return true;
      return v !== '0';
    } catch {
      return true;
    }
  }

  private static loadVolumePercent(): number {
    try {
      const raw = localStorage.getItem(MUSIC_VOLUME_KEY);
      if (raw === null) return MUSIC_VOLUME_DEFAULT;
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n)) return MUSIC_VOLUME_DEFAULT;
      return Math.max(0, Math.min(100, n));
    } catch {
      return MUSIC_VOLUME_DEFAULT;
    }
  }

  private static getSound(
    scene: Phaser.Scene,
    key: string,
  ): SoundWithVol | null {
    return (scene.sound.get(key) as SoundWithVol | null) ?? null;
  }

  static stopAll(scene: Phaser.Scene): void {
    for (const key of ALL_KEYS) {
      scene.sound.stopByKey(key);
    }
    Music.currentKey = null;
  }

  private static playKey(
    scene: Phaser.Scene,
    key: string,
    loop: boolean,
  ): void {
    if (!Music.enabled || Music.volPct <= 0) return;
    if (!scene.cache.audio.exists(key)) return;

    Music.stopAll(scene);
    scene.sound.play(key, {
      loop,
      volume: Music.volume,
    });
    Music.currentKey = key;
  }

  /** Title screen loop. */
  static playMenu(scene: Phaser.Scene): void {
    Music.currentLevelIndex = null;
    Music.playKey(scene, MUSIC_MENU, true);
  }

  /**
   * Start (or restart from the beginning) the soundtrack for this level.
   * Always picks a track by level index so each level feels fresh.
   */
  static playForLevel(scene: Phaser.Scene, levelIndex: number): void {
    const key = Music.trackKeyForLevel(levelIndex);
    Music.currentLevelIndex = levelIndex;
    // Always restart so "new level → new soundtrack start"
    Music.playKey(scene, key, true);
  }

  /** Short non-looping sting on level clear. */
  static playLevelClear(scene: Phaser.Scene): void {
    if (!Music.enabled || Music.volPct <= 0) return;
    if (!scene.cache.audio.exists(MUSIC_LEVEL_CLEAR)) return;
    // Stop level loop first so sting is clear
    if (Music.currentKey && Music.currentKey !== MUSIC_LEVEL_CLEAR) {
      scene.sound.stopByKey(Music.currentKey);
    }
    scene.sound.play(MUSIC_LEVEL_CLEAR, {
      loop: false,
      volume: Music.volume,
    });
    Music.currentKey = MUSIC_LEVEL_CLEAR;
  }

  /** Low-lives tension loop (optional hook). */
  static playDanger(scene: Phaser.Scene): void {
    Music.playKey(scene, MUSIC_DANGER, true);
  }

  /** @deprecated use playForLevel */
  static playGame(scene: Phaser.Scene): void {
    Music.playForLevel(scene, Music.currentLevelIndex ?? 0);
  }

  static pause(scene: Phaser.Scene): void {
    if (!Music.currentKey) return;
    const s = Music.getSound(scene, Music.currentKey);
    if (s?.isPlaying) s.pause();
  }

  static resume(scene: Phaser.Scene): void {
    if (!Music.enabled || Music.volPct <= 0) return;
    if (!Music.currentKey) {
      if (Music.currentLevelIndex !== null) {
        Music.playForLevel(scene, Music.currentLevelIndex);
      }
      return;
    }
    const s = Music.getSound(scene, Music.currentKey);
    if (s?.isPaused) {
      s.setVolume?.(Music.volume);
      s.resume();
      return;
    }
    if (!s?.isPlaying) {
      if (Music.currentLevelIndex !== null) {
        Music.playForLevel(scene, Music.currentLevelIndex);
      }
    }
  }

  static stop(scene: Phaser.Scene): void {
    Music.stopAll(scene);
    Music.currentLevelIndex = null;
  }

  static syncPlaying(scene: Phaser.Scene): void {
    if (!Music.enabled || Music.volPct <= 0) {
      if (Music.currentKey) {
        const s = Music.getSound(scene, Music.currentKey);
        if (s?.isPlaying) s.pause();
      }
      return;
    }
    if (Music.currentKey) {
      const s = Music.getSound(scene, Music.currentKey);
      if (s) {
        s.setVolume?.(Music.volume);
        if (s.isPaused) s.resume();
        return;
      }
    }
    if (Music.currentLevelIndex !== null) {
      Music.playForLevel(scene, Music.currentLevelIndex);
    }
  }

  static applyMuteState(scene: Phaser.Scene): void {
    Music.syncPlaying(scene);
  }
}
