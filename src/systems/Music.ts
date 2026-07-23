import type Phaser from 'phaser';
import {
  MUSIC_ENABLED_KEY,
  MUSIC_VOLUME_DEFAULT,
  MUSIC_VOLUME_KEY,
} from '../config';

/** Phaser.Sound.Events.UNLOCKED — string literal so tests need no Phaser DOM. */
const SOUND_UNLOCKED = 'unlocked';

/** Phaser audio keys (loaded in BootScene from public/audio/). */
export const MUSIC_MENU = 'music-menu';
export const MUSIC_MENU_EMBERGLASS = 'music-menu-emberglass';
export const MUSIC_MENU_LANTERNS = 'music-menu-lanterns';
export const MUSIC_MENU_STARLIGHT = 'music-menu-starlight';
export const MUSIC_LEVEL_CLEAR = 'music-level-clear';
export const MUSIC_DANGER = 'music-danger';
export const MUSIC_COIN_OP = 'music-coin-op';
export const MUSIC_GOBLIN_GEARSHIFT = 'music-goblin-gearshift';
export const MUSIC_MOLTEN_TOKEN_RUN = 'music-molten-token-run';
export const MUSIC_CRYPT_CIRCUIT = 'music-crypt-circuit';
export const MUSIC_RUNE_RAIL_RUSH = 'music-rune-rail-rush';
export const MUSIC_GOBLIN_VOLTAGE = 'music-goblin-voltage';
export const MUSIC_RUNE_RUNNER_RELAY = 'music-rune-runner-relay';
export const MUSIC_SHADOW_COIL_SPRINT = 'music-shadow-coil-sprint';
export const MUSIC_NEON_BOG_SPRINT = 'music-neon-bog-sprint';
export const MUSIC_CLOCKWORK_CAVERNS = 'music-clockwork-caverns';
export const MUSIC_CRYSTAL_CIRCUIT = 'music-crystal-circuit';

/** Rotating in-game loops — a new one starts each level (by index). */
export const GAMEPLAY_TRACKS = [
  MUSIC_COIN_OP,
  MUSIC_GOBLIN_GEARSHIFT,
  MUSIC_MOLTEN_TOKEN_RUN,
  MUSIC_CRYPT_CIRCUIT,
  MUSIC_RUNE_RAIL_RUSH,
  MUSIC_GOBLIN_VOLTAGE,
  MUSIC_RUNE_RUNNER_RELAY,
  MUSIC_SHADOW_COIL_SPRINT,
  MUSIC_NEON_BOG_SPRINT,
  MUSIC_CLOCKWORK_CAVERNS,
  MUSIC_CRYSTAL_CIRCUIT,
] as const;

export const MENU_TRACKS = [
  MUSIC_MENU,
  MUSIC_MENU_EMBERGLASS,
  MUSIC_MENU_LANTERNS,
  MUSIC_MENU_STARLIGHT,
] as const;

export const MUSIC_TRACK_ASSETS = [
  [MUSIC_MENU, 'audio/orc-ball-menu-moonlit-cartridge.mp3'],
  [MUSIC_MENU_EMBERGLASS, 'audio/orc-ball-menu-02-emberglass-title.mp3'],
  [MUSIC_MENU_LANTERNS, 'audio/orc-ball-menu-03-lanterns-at-spawn.mp3'],
  [MUSIC_MENU_STARLIGHT, 'audio/orc-ball-menu-04-save-slot-starlight.mp3'],
  [MUSIC_COIN_OP, 'audio/orc-ball-gameplay-coin-op-chase.mp3'],
  [MUSIC_GOBLIN_GEARSHIFT, 'audio/orc-ball-gameplay-02-goblin-gearshift.mp3'],
  [MUSIC_MOLTEN_TOKEN_RUN, 'audio/orc-ball-gameplay-03-molten-token-run.mp3'],
  [MUSIC_CRYPT_CIRCUIT, 'audio/orc-ball-gameplay-04-crypt-circuit.mp3'],
  [MUSIC_RUNE_RAIL_RUSH, 'audio/orc-ball-gameplay-05-rune-rail-rush.mp3'],
  [MUSIC_GOBLIN_VOLTAGE, 'audio/orc-ball-gameplay-06-goblin-voltage.mp3'],
  [MUSIC_RUNE_RUNNER_RELAY, 'audio/orc-ball-gameplay-07-rune-runner-relay.mp3'],
  [MUSIC_SHADOW_COIL_SPRINT, 'audio/orc-ball-gameplay-08-shadow-coil-sprint.mp3'],
  [MUSIC_NEON_BOG_SPRINT, 'audio/orc-ball-gameplay-09-neon-bog-sprint.mp3'],
  [MUSIC_CLOCKWORK_CAVERNS, 'audio/orc-ball-gameplay-10-clockwork-caverns.mp3'],
  [MUSIC_CRYSTAL_CIRCUIT, 'audio/orc-ball-gameplay-11-crystal-circuit.mp3'],
  [MUSIC_DANGER, 'audio/orc-ball-danger-one-heart-left.mp3'],
  [MUSIC_LEVEL_CLEAR, 'audio/orc-ball-level-clear-gem-secured.mp3'],
] as const;

const MENU_KEY_SET = new Set<string>(MENU_TRACKS);

/** Title-screen tracks only — boot these first so menu music can start ASAP. */
export const MENU_TRACK_ASSETS = MUSIC_TRACK_ASSETS.filter(([key]) =>
  MENU_KEY_SET.has(key),
);

/** Gameplay / cue tracks loaded in the background after the menu is up. */
export const DEFERRED_TRACK_ASSETS = MUSIC_TRACK_ASSETS.filter(
  ([key]) => !MENU_KEY_SET.has(key),
);

const ALL_KEYS = MUSIC_TRACK_ASSETS.map(([key]) => key);

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
  private static currentMenuKey: string | null = null;
  private static unlockBound = false;
  private static pendingLoop = true;

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

  /**
   * Pick a random title-screen loop. Prefer a different track than `excludeKey`
   * so revisiting the menu usually feels fresh.
   */
  static randomMenuTrackKey(excludeKey?: string | null): string {
    const all = MENU_TRACKS as readonly string[];
    const pool =
      excludeKey && all.includes(excludeKey)
        ? all.filter((k) => k !== excludeKey)
        : [...all];
    const i = Math.floor(Math.random() * pool.length);
    return pool[i] ?? all[0]!;
  }

  /** @deprecated use randomMenuTrackKey — kept for call-site compatibility. */
  static trackKeyForMenuVisit(_visitIndex?: number): string {
    return Music.randomMenuTrackKey();
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

  private static getAudioContext(scene: Phaser.Scene): AudioContext | null {
    const sound = scene.sound as Phaser.Sound.WebAudioSoundManager & {
      context?: AudioContext;
    };
    if (sound && 'context' in sound && sound.context) {
      return sound.context;
    }
    return null;
  }

  /** Resume WebAudio if the browser suspended it (autoplay policy). */
  static tryResumeContext(scene: Phaser.Scene): void {
    const ctx = Music.getAudioContext(scene);
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        Music.ensureAudible(scene);
      });
    }
  }

  /**
   * If the intended track exists but is silent (locked context / failed autoplay),
   * start or resume it.
   */
  static ensureAudible(scene: Phaser.Scene): void {
    if (!Music.enabled || Music.volPct <= 0) return;
    const key = Music.currentKey;
    if (!key || !scene.cache.audio.exists(key)) return;

    const s = Music.getSound(scene, key);
    if (s?.isPlaying) {
      s.setVolume?.(Music.volume);
      return;
    }
    if (s?.isPaused) {
      s.setVolume?.(Music.volume);
      s.resume();
      return;
    }

    scene.sound.stopByKey(key);
    scene.sound.play(key, {
      loop: Music.pendingLoop,
      volume: Music.volume,
    });
  }

  /**
   * Keep trying until the browser unlocks audio, then make sure menu/game BGM
   * is actually audible. Safe to call multiple times.
   */
  static armAutoplay(scene: Phaser.Scene): void {
    Music.tryResumeContext(scene);
    Music.ensureAudible(scene);

    if (!Music.unlockBound) {
      Music.unlockBound = true;
      scene.sound.once(SOUND_UNLOCKED, () => {
        Music.unlockBound = false;
        Music.tryResumeContext(scene);
        Music.ensureAudible(scene);
      });
    }

    // First user gesture on the page unlocks Chrome/Safari autoplay.
    const kick = (): void => {
      Music.tryResumeContext(scene);
      Music.ensureAudible(scene);
    };
    scene.input.once('pointerdown', kick);
    scene.input.keyboard?.once('keydown', kick);
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
    // Clear any previous selection even while music is off. Otherwise advancing
    // a level while disabled can resume the stale paused track when re-enabled.
    Music.stopAll(scene);
    Music.pendingLoop = loop;
    if (!Music.enabled || Music.volPct <= 0) return;
    if (!scene.cache.audio.exists(key)) return;

    Music.tryResumeContext(scene);
    scene.sound.play(key, {
      loop,
      volume: Music.volume,
    });
    Music.currentKey = key;
    // If autoplay is blocked, ensureAudible restarts once the context unlocks.
    Music.ensureAudible(scene);
  }

  /** Title screen loop — random track each visit. */
  static playMenu(scene: Phaser.Scene): void {
    const key = Music.randomMenuTrackKey(Music.currentMenuKey);
    Music.currentLevelIndex = null;
    Music.currentMenuKey = key;
    Music.playKey(scene, key, true);
    Music.armAutoplay(scene);
  }

  /**
   * Start (or restart from the beginning) the soundtrack for this level.
   * Always picks a track by level index so each level feels fresh.
   */
  static playForLevel(scene: Phaser.Scene, levelIndex: number): void {
    const key = Music.trackKeyForLevel(levelIndex);
    Music.currentMenuKey = null;
    Music.currentLevelIndex = levelIndex;
    // Always restart so "new level → new soundtrack start"
    Music.playKey(scene, key, true);
  }

  /** Short non-looping sting on level clear. */
  static playLevelClear(scene: Phaser.Scene): void {
    if (!Music.enabled || Music.volPct <= 0) return;
    if (!scene.cache.audio.exists(MUSIC_LEVEL_CLEAR)) return;
    Music.currentMenuKey = null;
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
    Music.currentMenuKey = null;
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
    Music.currentMenuKey = null;
  }

  static syncPlaying(scene: Phaser.Scene): void {
    if (!Music.enabled || Music.volPct <= 0) {
      if (Music.currentKey) {
        const s = Music.getSound(scene, Music.currentKey);
        if (s?.isPlaying) s.pause();
      }
      return;
    }
    Music.tryResumeContext(scene);
    if (Music.currentKey) {
      const s = Music.getSound(scene, Music.currentKey);
      if (s) {
        s.setVolume?.(Music.volume);
        if (s.isPaused) {
          s.resume();
          return;
        }
        if (s.isPlaying) return;
        // Exists but silent (common after blocked autoplay) — restart.
        Music.ensureAudible(scene);
        return;
      }
    }
    if (Music.currentLevelIndex !== null) {
      Music.playForLevel(scene, Music.currentLevelIndex);
      return;
    }
    if (Music.currentMenuKey) {
      Music.playKey(scene, Music.currentMenuKey, true);
    }
  }

  static applyMuteState(scene: Phaser.Scene): void {
    Music.syncPlaying(scene);
  }
}
