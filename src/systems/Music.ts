import type Phaser from 'phaser';
import {
  MUSIC_ENABLED_KEY,
  MUSIC_VOLUME_DEFAULT,
  MUSIC_VOLUME_KEY,
} from '../config';

/** In-game BGM keys (loaded in BootScene). */
export const MUSIC_GAME = 'music-game';

/**
 * Background music helpers with independent on/off + volume (0–100%).
 * Track: Alp.traum – Binary Eagle (public/audio/binary-eagle.mp3)
 * Settings persist in localStorage (separate from SFX mute).
 */
export class Music {
  private static enabled = Music.loadEnabled();
  private static volPct = Music.loadVolumePercent();

  static get isEnabled(): boolean {
    return Music.enabled;
  }

  /** 0–100 */
  static get volumePercent(): number {
    return Music.volPct;
  }

  /** Linear gain 0–1 used by Phaser (0 if music off). */
  static get volume(): number {
    if (!Music.enabled) return 0;
    return Math.max(0, Math.min(1, Music.volPct / 100));
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

  /** Clamp and store 0–100; update playing track if any. */
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

  static playGame(scene: Phaser.Scene): void {
    if (!Music.enabled || Music.volPct <= 0) return;
    if (!scene.cache.audio.exists(MUSIC_GAME)) return;

    const existing = scene.sound.get(MUSIC_GAME) as
      | (Phaser.Sound.BaseSound & { setVolume?: (v: number) => void })
      | null;
    if (existing?.isPlaying) {
      existing.setVolume?.(Music.volume);
      return;
    }
    if (existing?.isPaused) {
      existing.setVolume?.(Music.volume);
      existing.resume();
      return;
    }

    scene.sound.play(MUSIC_GAME, {
      loop: true,
      volume: Music.volume,
    });
  }

  static pause(scene: Phaser.Scene): void {
    const s = scene.sound.get(MUSIC_GAME) as Phaser.Sound.BaseSound | null;
    if (s?.isPlaying) s.pause();
  }

  static resume(scene: Phaser.Scene): void {
    if (!Music.enabled || Music.volPct <= 0) return;
    const s = scene.sound.get(MUSIC_GAME) as
      | (Phaser.Sound.BaseSound & { setVolume?: (v: number) => void })
      | null;
    if (s?.isPaused) {
      s.setVolume?.(Music.volume);
      s.resume();
      return;
    }
    if (!s?.isPlaying) {
      Music.playGame(scene);
    }
  }

  static stop(scene: Phaser.Scene): void {
    scene.sound.stopByKey(MUSIC_GAME);
  }

  /** Apply current enabled/volume to a playing instance (or stop if off). */
  static syncPlaying(scene: Phaser.Scene): void {
    const s = scene.sound.get(MUSIC_GAME) as
      | (Phaser.Sound.BaseSound & { setVolume?: (v: number) => void })
      | null;
    if (!Music.enabled || Music.volPct <= 0) {
      if (s?.isPlaying) s.pause();
      return;
    }
    if (s?.isPlaying || s?.isPaused) {
      s.setVolume?.(Music.volume);
      if (s.isPaused) s.resume();
      return;
    }
    // Not in game scene with music — nothing to start here
  }

  /** @deprecated use syncPlaying / enabled flag */
  static applyMuteState(scene: Phaser.Scene): void {
    Music.syncPlaying(scene);
  }
}
