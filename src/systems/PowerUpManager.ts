import Phaser from 'phaser';
import { POWERUP_DURATION_MS } from '../config';
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

  get paddleScale(): number {
    return this.state.paddleScale;
  }

  getState(): Readonly<PowerUpState> {
    return this.state;
  }

  collect(type: PowerUpType): void {
    const now = this.scene.time.now;
    const result = applyPowerUp(this.state, type, now, POWERUP_DURATION_MS);
    this.state = result.state;

    if (type === 'SHRINK') this.hooks.onMalus?.();
    else if (type === 'EXTRA_LIFE') {
      if (result.gainedLife) this.hooks.onExtraLife?.();
    } else {
      this.hooks.onBonus?.();
    }

    if (result.spawnMultiball) {
      this.hooks.onMultiball();
    }

    if (result.gainedLife) {
      this.hooks.onLivesChanged(this.state.lives);
    }

    if (type === 'EXPAND') {
      this.clearTimer('SHRINK');
      this.paddle.setWidthScale(this.state.paddleScale);
      this.scheduleTimed('EXPAND');
    } else if (type === 'SHRINK') {
      this.clearTimer('EXPAND');
      this.paddle.setWidthScale(this.state.paddleScale);
      this.scheduleTimed('SHRINK');
    } else if (type === 'STICKY') {
      this.paddle.sticky = true;
      this.scheduleTimed('STICKY');
    } else if (type === 'FIREBALL') {
      this.applyFireballToAll(true);
      this.scheduleTimed('FIREBALL');
    }
  }

  private scheduleTimed(effect: TimedEffect): void {
    this.clearTimer(effect);
    const timer = this.scene.time.delayedCall(POWERUP_DURATION_MS, () => {
      this.expire(effect);
    });
    this.timers.set(effect, timer);
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
      }
    }
    if (effect === 'STICKY') {
      this.state.sticky = false;
      this.paddle.sticky = false;
    }
    if (effect === 'FIREBALL') {
      this.state.fireball = false;
      this.applyFireballToAll(false);
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
    this.paddle.sticky = false;
    this.applyFireballToAll(false);
  }

  destroy(): void {
    for (const effect of [...this.timers.keys()]) {
      this.clearTimer(effect);
    }
  }
}
