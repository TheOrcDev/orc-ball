import Phaser from 'phaser';
import { SOUND_MUTED_KEY } from '../config';

/**
 * Procedural WebAudio SFX via Phaser sound context.
 * Unlock happens after first user gesture (menu SPACE).
 * Mute is global and persisted in localStorage.
 */
export class Sfx {
  private scene: Phaser.Scene;
  private unlocked = false;
  private static muted = Sfx.loadMuted();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const sound = scene.sound;
    if (!sound.locked) {
      this.unlocked = true;
    } else {
      sound.once(Phaser.Sound.Events.UNLOCKED, () => {
        this.unlocked = true;
      });
    }
  }

  get isUnlocked(): boolean {
    return this.unlocked || !this.scene.sound.locked;
  }

  static get isMuted(): boolean {
    return Sfx.muted;
  }

  static setMuted(muted: boolean): void {
    Sfx.muted = muted;
    try {
      localStorage.setItem(SOUND_MUTED_KEY, muted ? '1' : '0');
    } catch {
      // ignore
    }
  }

  static toggleMuted(): boolean {
    Sfx.setMuted(!Sfx.muted);
    return Sfx.muted;
  }

  private static loadMuted(): boolean {
    try {
      return localStorage.getItem(SOUND_MUTED_KEY) === '1';
    } catch {
      return false;
    }
  }

  /** Call on first SPACE / click to satisfy autoplay policy. */
  tryUnlock(): void {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    this.unlocked = !this.scene.sound.locked;
  }

  private getAudioContext(): AudioContext | null {
    const sound = this.scene.sound as Phaser.Sound.WebAudioSoundManager & {
      context?: AudioContext;
    };
    if (sound && 'context' in sound && sound.context) {
      return sound.context;
    }
    return null;
  }

  private blip(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    gain = 0.08,
    freqEnd?: number,
  ): void {
    if (Sfx.muted || !this.isUnlocked) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (freqEnd !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, freqEnd),
          ctx.currentTime + duration,
        );
      }
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio errors (headless / restricted)
    }
  }

  private noiseBurst(duration: number, gain = 0.05): void {
    if (Sfx.muted || !this.isUnlocked) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
    } catch {
      // ignore
    }
  }

  paddleHit(): void {
    this.blip(220, 0.06, 'square', 0.07);
  }

  wallHit(): void {
    this.blip(140, 0.04, 'triangle', 0.04);
  }

  /** Pitch scales with remaining HP (higher HP → lower pitch). */
  brickHit(hpRemaining: number): void {
    const base = 320 + Math.max(0, 3 - hpRemaining) * 80;
    this.blip(base, 0.05, 'square', 0.06);
  }

  brickBreak(): void {
    this.blip(480, 0.12, 'sawtooth', 0.07, 120);
    this.noiseBurst(0.08, 0.04);
  }

  powerUp(): void {
    this.blip(523, 0.06, 'square', 0.06);
    setTimeout(() => this.blip(659, 0.06, 'square', 0.06), 60);
    setTimeout(() => this.blip(784, 0.08, 'square', 0.06), 120);
  }

  powerDown(): void {
    this.blip(400, 0.08, 'square', 0.06, 180);
  }

  loseLife(): void {
    this.blip(180, 0.2, 'sawtooth', 0.08, 60);
  }

  levelClear(): void {
    this.blip(523, 0.08, 'square', 0.07);
    setTimeout(() => this.blip(659, 0.08, 'square', 0.07), 100);
    setTimeout(() => this.blip(784, 0.08, 'square', 0.07), 200);
    setTimeout(() => this.blip(1046, 0.15, 'square', 0.08), 300);
  }

  gameOver(): void {
    this.blip(300, 0.15, 'sawtooth', 0.08, 100);
    setTimeout(() => this.blip(200, 0.2, 'sawtooth', 0.07, 60), 180);
  }
}
