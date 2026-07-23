import type Phaser from 'phaser';
import { Sfx } from './Sfx';

/** In-game BGM keys (loaded in BootScene). */
export const MUSIC_GAME = 'music-game';

const GAME_VOLUME = 0.28;

/**
 * Background music helpers. Respects Sfx mute flag.
 * Track: Alp.traum – Binary Eagle (public/audio/binary-eagle.mp3)
 */
export class Music {
  static playGame(scene: Phaser.Scene): void {
    if (Sfx.isMuted) return;
    if (!scene.cache.audio.exists(MUSIC_GAME)) return;

    const existing = scene.sound.get(MUSIC_GAME) as Phaser.Sound.BaseSound | null;
    if (existing?.isPlaying) return;
    if (existing?.isPaused) {
      existing.resume();
      return;
    }

    scene.sound.play(MUSIC_GAME, {
      loop: true,
      volume: GAME_VOLUME,
    });
  }

  static pause(scene: Phaser.Scene): void {
    const s = scene.sound.get(MUSIC_GAME) as Phaser.Sound.BaseSound | null;
    if (s?.isPlaying) s.pause();
  }

  static resume(scene: Phaser.Scene): void {
    if (Sfx.isMuted) return;
    const s = scene.sound.get(MUSIC_GAME) as Phaser.Sound.BaseSound | null;
    if (s?.isPaused) {
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

  /** After mute toggle: silence or restart game music. */
  static applyMuteState(scene: Phaser.Scene): void {
    if (Sfx.isMuted) {
      Music.pause(scene);
    } else {
      Music.resume(scene);
    }
  }
}
