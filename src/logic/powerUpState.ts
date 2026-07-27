import type { PowerUpType } from '../data/types';
import {
  MAX_LIVES,
  PADDLE_SCALE_EXPAND,
  PADDLE_SCALE_NORMAL,
  PADDLE_SCALE_SHRINK,
  POWERUP_DURATION_MS,
} from '../config';

export type TimedEffect =
  | 'EXPAND'
  | 'SHRINK'
  | 'STICKY'
  | 'FIREBALL'
  | 'LASER'
  | 'SLOW'
  | 'EXPLODE';

export const TIMED_EFFECTS: readonly TimedEffect[] = [
  'EXPAND',
  'SHRINK',
  'STICKY',
  'FIREBALL',
  'LASER',
  'SLOW',
  'EXPLODE',
] as const;

export interface PowerUpState {
  active: Set<TimedEffect>;
  /** expiry timestamps (ms) for active timed effects */
  expiresAt: Map<TimedEffect, number>;
  paddleScale: number;
  sticky: boolean;
  fireball: boolean;
  laser: boolean;
  slow: boolean;
  explode: boolean;
  lives: number;
}

export function createPowerUpState(lives: number): PowerUpState {
  return {
    active: new Set(),
    expiresAt: new Map(),
    paddleScale: PADDLE_SCALE_NORMAL,
    sticky: false,
    fireball: false,
    laser: false,
    slow: false,
    explode: false,
    lives,
  };
}

export function isTimedEffect(t: PowerUpType): t is TimedEffect {
  return (TIMED_EFFECTS as readonly string[]).includes(t);
}

export function isInstantEffect(t: PowerUpType): boolean {
  return t === 'MULTIBALL' || t === 'EXTRA_LIFE';
}

/**
 * Stack another full duration onto an effect.
 * Active remaining time is kept: 2× laser = 12s + 12s, not a reset to 12s.
 */
export function stackedExpiry(
  expiresAt: ReadonlyMap<TimedEffect, number>,
  effect: TimedEffect,
  nowMs: number,
  durationMs: number,
): number {
  const current = expiresAt.get(effect);
  const base = current !== undefined && current > nowMs ? current : nowMs;
  return base + durationMs;
}

/**
 * Apply a power-up to pure state. Returns side-effect flags for the game layer.
 * Timed re-collect stacks duration onto remaining time; no double-apply of scale.
 * EXPAND ↔ SHRINK are mutually exclusive (swap replaces the other).
 */
export function applyPowerUp(
  state: PowerUpState,
  type: PowerUpType,
  nowMs: number,
  durationMs: number = POWERUP_DURATION_MS,
): {
  state: PowerUpState;
  spawnMultiball: boolean;
  gainedLife: boolean;
  refreshed: boolean;
  applied: boolean;
} {
  const next: PowerUpState = {
    active: new Set(state.active),
    expiresAt: new Map(state.expiresAt),
    paddleScale: state.paddleScale,
    sticky: state.sticky,
    fireball: state.fireball,
    laser: state.laser,
    slow: state.slow,
    explode: state.explode,
    lives: state.lives,
  };

  if (type === 'EXTRA_LIFE') {
    const before = next.lives;
    next.lives = Math.min(MAX_LIVES, next.lives + 1);
    return {
      state: next,
      spawnMultiball: false,
      gainedLife: next.lives > before,
      refreshed: false,
      applied: next.lives > before,
    };
  }

  if (type === 'MULTIBALL') {
    return {
      state: next,
      spawnMultiball: true,
      gainedLife: false,
      refreshed: false,
      applied: true,
    };
  }

  // Timed effects — stack duration onto any remaining time
  const wasActive = next.active.has(type as TimedEffect);
  const stack = (effect: TimedEffect): number =>
    stackedExpiry(next.expiresAt, effect, nowMs, durationMs);

  if (type === 'EXPAND') {
    if (next.active.has('SHRINK')) {
      next.active.delete('SHRINK');
      next.expiresAt.delete('SHRINK');
    }
    next.active.add('EXPAND');
    next.expiresAt.set('EXPAND', stack('EXPAND'));
    next.paddleScale = PADDLE_SCALE_EXPAND;
    return {
      state: next,
      spawnMultiball: false,
      gainedLife: false,
      refreshed: wasActive,
      applied: true,
    };
  }

  if (type === 'SHRINK') {
    if (next.active.has('EXPAND')) {
      next.active.delete('EXPAND');
      next.expiresAt.delete('EXPAND');
    }
    next.active.add('SHRINK');
    next.expiresAt.set('SHRINK', stack('SHRINK'));
    next.paddleScale = PADDLE_SCALE_SHRINK;
    return {
      state: next,
      spawnMultiball: false,
      gainedLife: false,
      refreshed: wasActive,
      applied: true,
    };
  }

  if (type === 'STICKY') {
    next.active.add('STICKY');
    next.expiresAt.set('STICKY', stack('STICKY'));
    next.sticky = true;
    return {
      state: next,
      spawnMultiball: false,
      gainedLife: false,
      refreshed: wasActive,
      applied: true,
    };
  }

  if (type === 'FIREBALL') {
    next.active.add('FIREBALL');
    next.expiresAt.set('FIREBALL', stack('FIREBALL'));
    next.fireball = true;
    return {
      state: next,
      spawnMultiball: false,
      gainedLife: false,
      refreshed: wasActive,
      applied: true,
    };
  }

  if (type === 'LASER') {
    next.active.add('LASER');
    next.expiresAt.set('LASER', stack('LASER'));
    next.laser = true;
    return {
      state: next,
      spawnMultiball: false,
      gainedLife: false,
      refreshed: wasActive,
      applied: true,
    };
  }

  if (type === 'SLOW') {
    next.active.add('SLOW');
    next.expiresAt.set('SLOW', stack('SLOW'));
    next.slow = true;
    return {
      state: next,
      spawnMultiball: false,
      gainedLife: false,
      refreshed: wasActive,
      applied: true,
    };
  }

  if (type === 'EXPLODE') {
    next.active.add('EXPLODE');
    next.expiresAt.set('EXPLODE', stack('EXPLODE'));
    next.explode = true;
    return {
      state: next,
      spawnMultiball: false,
      gainedLife: false,
      refreshed: wasActive,
      applied: true,
    };
  }

  return {
    state: next,
    spawnMultiball: false,
    gainedLife: false,
    refreshed: false,
    applied: false,
  };
}

/** Expire timed effects whose timer has elapsed; revert paddle/flags. */
export function tickPowerUpExpiry(
  state: PowerUpState,
  nowMs: number,
): PowerUpState {
  const next: PowerUpState = {
    active: new Set(state.active),
    expiresAt: new Map(state.expiresAt),
    paddleScale: state.paddleScale,
    sticky: state.sticky,
    fireball: state.fireball,
    laser: state.laser,
    slow: state.slow,
    explode: state.explode,
    lives: state.lives,
  };

  for (const effect of [...next.active]) {
    const exp = next.expiresAt.get(effect);
    if (exp !== undefined && nowMs >= exp) {
      next.active.delete(effect);
      next.expiresAt.delete(effect);
      if (effect === 'EXPAND' || effect === 'SHRINK') {
        if (!next.active.has('EXPAND') && !next.active.has('SHRINK')) {
          next.paddleScale = PADDLE_SCALE_NORMAL;
        } else if (next.active.has('EXPAND')) {
          next.paddleScale = PADDLE_SCALE_EXPAND;
        } else if (next.active.has('SHRINK')) {
          next.paddleScale = PADDLE_SCALE_SHRINK;
        }
      }
      if (effect === 'STICKY') next.sticky = false;
      if (effect === 'FIREBALL') next.fireball = false;
      if (effect === 'LASER') next.laser = false;
      if (effect === 'SLOW') next.slow = false;
      if (effect === 'EXPLODE') next.explode = false;
    }
  }
  return next;
}

/** Full reset on life lost / level end. */
export function resetPowerUpState(
  state: PowerUpState,
  keepLives = true,
): PowerUpState {
  return {
    active: new Set(),
    expiresAt: new Map(),
    paddleScale: PADDLE_SCALE_NORMAL,
    sticky: false,
    fireball: false,
    laser: false,
    slow: false,
    explode: false,
    lives: keepLives ? state.lives : state.lives,
  };
}

export function paddleScaleForState(state: PowerUpState): number {
  if (state.active.has('EXPAND')) return PADDLE_SCALE_EXPAND;
  if (state.active.has('SHRINK')) return PADDLE_SCALE_SHRINK;
  return PADDLE_SCALE_NORMAL;
}

/** World X positions of twin laser muzzles at paddle ends. */
export function laserMuzzleXs(
  paddleX: number,
  paddleDisplayWidth: number,
  inset = 6,
): { left: number; right: number } {
  const half = paddleDisplayWidth / 2;
  return {
    left: paddleX - half + inset,
    right: paddleX + half - inset,
  };
}
