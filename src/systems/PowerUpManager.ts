import Phaser from 'phaser';
import {
  COLORS,
  POWERUP_DURATION_BULLET_MS,
  POWERUP_DURATION_EXPLODE_MS,
  POWERUP_DURATION_GLUE_MS,
  POWERUP_DURATION_LASER_MS,
  POWERUP_DURATION_MS,
  POWERUP_DURATION_SLOW_MS,
  POWERUP_WARN_MS,
} from '../config';
import type { PowerUpType } from '../data/types';
import {
  expiryBlinkAlpha,
  isExpiringSoon,
  remainingMs,
} from '../logic/powerUpCountdown';
import {
  applyPowerUp,
  createPowerUpState,
  resetPowerUpState,
  type PowerUpState,
  type TimedEffect,
} from '../logic/powerUpState';
import type { Ball } from '../objects/Ball';
import type { Paddle } from '../objects/Paddle';

export type EffectExpirySnapshot = {
  sticky: number;
  fireball: number;
  laser: number;
  slow: number;
  explode: number;
  expand: number;
  shrink: number;
};

export type PowerUpHooks = {
  onMultiball: () => void;
  onLivesChanged: (lives: number) => void;
  onExtraLife?: () => void;
  onMalus?: () => void;
  onBonus?: () => void;
  /** Fired when glue (sticky) expires — launch any stuck balls. */
  onStickyExpired?: () => void;
  onEffectsChanged?: (
    effects: {
      sticky: boolean;
      fireball: boolean;
      expand: boolean;
      shrink: boolean;
      laser: boolean;
      slow: boolean;
      explode: boolean;
    },
    expiresAt: EffectExpirySnapshot,
  ) => void;
  onMultiballVisual?: () => void;
  /** Sync ball speeds after SLOW is applied / cleared. */
  onSlowChanged?: (slow: boolean) => void;
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

  get isSlow(): boolean {
    return this.state.slow;
  }

  get isExplode(): boolean {
    return this.state.explode;
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
    if (type === 'SLOW') return POWERUP_DURATION_SLOW_MS;
    if (type === 'EXPLODE') return POWERUP_DURATION_EXPLODE_MS;
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
    } else if (type === 'SLOW') {
      this.scheduleTimed('SLOW', duration);
      this.hooks.onSlowChanged?.(true);
      this.emitEffects();
    } else if (type === 'EXPLODE') {
      this.applyExplodeToAll(true);
      this.scheduleTimed('EXPLODE', duration);
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

  /** Absolute expiry timestamps (ms) for HUD countdown; 0 when inactive. */
  getExpirySnapshot(): EffectExpirySnapshot {
    const at = (effect: TimedEffect): number =>
      this.state.expiresAt.get(effect) ?? 0;
    return {
      sticky: at('STICKY'),
      fireball: at('FIREBALL'),
      laser: at('LASER'),
      slow: at('SLOW'),
      explode: at('EXPLODE'),
      expand: at('EXPAND'),
      shrink: at('SHRINK'),
    };
  }

  remainingFor(effect: TimedEffect, nowMs: number): number {
    return remainingMs(this.state.expiresAt.get(effect), nowMs);
  }

  /**
   * Flash paddle / balls in the last seconds of a timed power-up so the
   * player can see glue, bullet, laser, etc. about to drop.
   */
  syncExpiryWarningVisuals(nowMs: number): void {
    const warn = POWERUP_WARN_MS;
    const paddleEffects: TimedEffect[] = [
      'STICKY',
      'LASER',
      'EXPAND',
      'SHRINK',
    ];
    let paddleRemaining = Number.POSITIVE_INFINITY;
    for (const effect of paddleEffects) {
      const left = this.remainingFor(effect, nowMs);
      if (isExpiringSoon(left, warn)) {
        paddleRemaining = Math.min(paddleRemaining, left);
      }
    }
    const paddleAlpha =
      paddleRemaining === Number.POSITIVE_INFINITY
        ? 1
        : expiryBlinkAlpha(nowMs, paddleRemaining);
    this.paddle.setAlpha(paddleAlpha);

    for (const ball of this.getBalls()) {
      if (!ball.active) continue;
      const flashFire =
        ball.isFireball &&
        isExpiringSoon(this.remainingFor('FIREBALL', nowMs), warn);
      const flashBlast =
        ball.isExplosive &&
        isExpiringSoon(this.remainingFor('EXPLODE', nowMs), warn);
      if (!flashFire && !flashBlast) {
        ball.setAlpha(1);
        continue;
      }
      const ballLeft = Math.min(
        flashFire ? this.remainingFor('FIREBALL', nowMs) : Infinity,
        flashBlast ? this.remainingFor('EXPLODE', nowMs) : Infinity,
      );
      ball.setAlpha(expiryBlinkAlpha(nowMs, ballLeft));
    }
  }

  private emitEffects(): void {
    this.hooks.onEffectsChanged?.(
      {
        sticky: this.state.sticky,
        fireball: this.state.fireball,
        expand: this.state.active.has('EXPAND'),
        shrink: this.state.active.has('SHRINK'),
        laser: this.state.laser,
        slow: this.state.slow,
        explode: this.state.explode,
      },
      this.getExpirySnapshot(),
    );
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
    if (effect === 'SLOW') {
      this.state.slow = false;
      this.hooks.onSlowChanged?.(false);
      this.emitEffects();
    }
    if (effect === 'EXPLODE') {
      this.state.explode = false;
      this.applyExplodeToAll(false);
      this.emitEffects();
    }
  }

  applyFireballToAll(active: boolean): void {
    for (const ball of this.getBalls()) {
      if (ball.active) ball.setFireball(active);
    }
  }

  applyExplodeToAll(active: boolean): void {
    for (const ball of this.getBalls()) {
      if (ball.active) ball.setExplosive(active);
    }
  }

  /** Apply active ball effects to a newly spawned ball. */
  decorateNewBall(ball: Ball): void {
    if (this.state.fireball) ball.setFireball(true);
    if (this.state.explode) ball.setExplosive(true);
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
    this.paddle.setAlpha(1);
    this.applyFireballToAll(false);
    this.applyExplodeToAll(false);
    for (const ball of this.getBalls()) {
      if (ball.active) ball.setAlpha(1);
    }
    this.hooks.onSlowChanged?.(false);
    this.emitEffects();
  }

  destroy(): void {
    for (const effect of [...this.timers.keys()]) {
      this.clearTimer(effect);
    }
  }
}
