import Phaser from 'phaser';
import {
  COLORS,
  POWERUP_DURATION_BULLET_MS,
  POWERUP_DURATION_GLUE_MS,
  POWERUP_DURATION_LASER_MS,
  POWERUP_DURATION_MS,
} from '../config';
import type { PowerUpType } from '../data/types';
import {
  applyPowerUp,
  createPowerUpState,
  resetPowerUpState,
  type PowerUpState,
  type TimedEffect,
} from '../logic/powerUpState';
import type { Ball } from '../objects/Ball';
import type { Paddle } from '../objects/Paddle';

export type PowerUpHooks = {
  onMultiball: () => void;
  onLivesChanged: (lives: number) => void;
  onExtraLife?: () => void;
  onMalus?: () => void;
  onBonus?: () => void;
  /** Fired when glue (sticky) expires — launch any stuck balls. */
  onStickyExpired?: () => void;
  onEffectsChanged?: (effects: {
    sticky: boolean;
    fireball: boolean;
    expand: boolean;
    shrink: boolean;
    laser: boolean;
  }) => void;
  onMultiballVisual?: () => void;
};

/**
 * Manages timed power-up effects via Phaser timers, synced with pure state.
 */
export class PowerUpManager {
  private scene: Phaser.Scene;
  private state: PowerUpState;
  private timers = new Map<TimedEffect, Phaser.Time.TimerEvent>();
  private paddle: Paddle;
  private getBalls: () => Ball[];
  private hooks: PowerUpHooks;

  constructor(
    scene: Phaser.Scene,
    paddle: Paddle,
    getBalls: () => Ball[],
    lives: number,
    hooks: PowerUpHooks,
  ) {
    this.scene = scene;
    this.paddle = paddle;
    this.getBalls = getBalls;
    this.hooks = hooks;
    this.state = createPowerUpState(lives);
  }

  get lives(): number {
    return this.state.lives;
  }

  setLives(n: number): void {
    this.state.lives = n;
  }

  get isSticky(): boolean {
    return this.state.sticky;
  }

  get isFireball(): boolean {
    return this.state.fireball;
  }

  get isLaser(): boolean {
    return this.state.laser;
  }

  get paddleScale(): number {
    return this.state.paddleScale;
  }

  getState(): Readonly<PowerUpState> {
    return this.state;
  }

  private durationFor(type: PowerUpType): number {
    if (type === 'STICKY') return POWERUP_DURATION_GLUE_MS;
    if (type === 'FIREBALL') return POWERUP_DURATION_BULLET_MS;
    if (type === 'LASER') return POWERUP_DURATION_LASER_MS;
    return POWERUP_DURATION_MS;
  }

  collect(type: PowerUpType): void {
    const now = this.scene.time.now;
    const duration = this.durationFor(type);
    const result = applyPowerUp(this.state, type, now, duration);
    this.state = result.state;

    if (type === 'SHRINK') this.hooks.onMalus?.();
    else if (type === 'EXTRA_LIFE') {
      if (result.gainedLife) this.hooks.onExtraLife?.();
    } else {
      this.hooks.onBonus?.();
    }

    if (result.spawnMultiball) {
      this.hooks.onMultiball();
      this.hooks.onMultiballVisual?.();
    }

    if (result.gainedLife) {
      this.hooks.onLivesChanged(this.state.lives);
    }

    if (type === 'EXPAND') {
      this.clearTimer('SHRINK');
      this.paddle.setWidthScale(this.state.paddleScale);
      if (!this.state.sticky) {
        this.paddle.clearTint();
        this.paddle.setTint(COLORS.expand);
      }
      this.scheduleTimed('EXPAND', duration);
      this.emitEffects();
    } else if (type === 'SHRINK') {
      this.clearTimer('EXPAND');
      this.paddle.setWidthScale(this.state.paddleScale);
      if (!this.state.sticky) {
        this.paddle.setTint(COLORS.shrink);
      }
      this.scheduleTimed('SHRINK', duration);
      this.emitEffects();
    } else if (type === 'STICKY') {
      this.paddle.setGlueLook(true);
      this.scheduleTimed('STICKY', duration);
      this.emitEffects();
    } else if (type === 'FIREBALL') {
      this.applyFireballToAll(true);
      this.scheduleTimed('FIREBALL', duration);
      this.emitEffects();
    } else if (type === 'LASER') {
      this.paddle.setLaserLook(true);
      this.scheduleTimed('LASER', duration);
      this.emitEffects();
    }
  }

  private scheduleTimed(effect: TimedEffect, durationMs: number): void {
    this.clearTimer(effect);
    const timer = this.scene.time.delayedCall(durationMs, () => {
      this.expire(effect);
    });
    this.timers.set(effect, timer);
  }

  private emitEffects(): void {
    this.hooks.onEffectsChanged?.({
      sticky: this.state.sticky,
      fireball: this.state.fireball,
      expand: this.state.active.has('EXPAND'),
      shrink: this.state.active.has('SHRINK'),
      laser: this.state.laser,
    });
  }

  private clearTimer(effect: TimedEffect): void {
    const t = this.timers.get(effect);
    if (t) {
      t.remove(false);
      this.timers.delete(effect);
    }
  }

  private expire(effect: TimedEffect): void {
    this.timers.delete(effect);
    this.state.active.delete(effect);
    this.state.expiresAt.delete(effect);

    if (effect === 'EXPAND' || effect === 'SHRINK') {
      if (!this.state.active.has('EXPAND') && !this.state.active.has('SHRINK')) {
        this.state.paddleScale = 1;
        this.paddle.resetWidth();
        if (this.state.sticky) {
          this.paddle.setGlueLook(true);
        } else {
          this.paddle.clearTint();
        }
      }
      this.emitEffects();
    }
    if (effect === 'STICKY') {
      this.state.sticky = false;
      this.paddle.setGlueLook(false);
      if (this.state.active.has('EXPAND')) this.paddle.setTint(COLORS.expand);
      else if (this.state.active.has('SHRINK')) this.paddle.setTint(COLORS.shrink);
      else this.paddle.clearTint();
      this.hooks.onStickyExpired?.();
      this.emitEffects();
    }
    if (effect === 'FIREBALL') {
      this.state.fireball = false;
      this.applyFireballToAll(false);
      this.emitEffects();
    }
    if (effect === 'LASER') {
      this.state.laser = false;
      this.paddle.setLaserLook(false);
      this.emitEffects();
    }
  }

  applyFireballToAll(active: boolean): void {
    for (const ball of this.getBalls()) {
      if (ball.active) ball.setFireball(active);
    }
  }

  /** Apply fireball tint to a newly spawned ball if effect is active. */
  decorateNewBall(ball: Ball): void {
    if (this.state.fireball) ball.setFireball(true);
  }

  reset(): void {
    for (const effect of [...this.timers.keys()]) {
      this.clearTimer(effect);
    }
    this.state = resetPowerUpState(this.state, true);
    this.paddle.resetWidth();
    this.paddle.setGlueLook(false);
    this.paddle.setLaserLook(false);
    this.paddle.clearTint();
    this.applyFireballToAll(false);
    this.emitEffects();
  }

  destroy(): void {
    for (const effect of [...this.timers.keys()]) {
      this.clearTimer(effect);
    }
  }
}
