import { describe, expect, it } from 'vitest';
import {
  MAX_LIVES,
  PADDLE_SCALE_EXPAND,
  PADDLE_SCALE_NORMAL,
  PADDLE_SCALE_SHRINK,
  POWERUP_DURATION_MS,
} from '../config';
import {
  applyPowerUp,
  createPowerUpState,
  laserMuzzleXs,
  resetPowerUpState,
  tickPowerUpExpiry,
} from './powerUpState';

describe('applyPowerUp', () => {
  it('EXPAND sets paddle scale and is timed', () => {
    const s0 = createPowerUpState(3);
    const { state, applied } = applyPowerUp(s0, 'EXPAND', 1000);
    expect(applied).toBe(true);
    expect(state.paddleScale).toBe(PADDLE_SCALE_EXPAND);
    expect(state.active.has('EXPAND')).toBe(true);
    expect(state.expiresAt.get('EXPAND')).toBe(1000 + POWERUP_DURATION_MS);
  });

  it('EXPAND and SHRINK are mutually exclusive', () => {
    let s = createPowerUpState(3);
    s = applyPowerUp(s, 'EXPAND', 0).state;
    s = applyPowerUp(s, 'SHRINK', 100).state;
    expect(s.active.has('EXPAND')).toBe(false);
    expect(s.active.has('SHRINK')).toBe(true);
    expect(s.paddleScale).toBe(PADDLE_SCALE_SHRINK);

    s = applyPowerUp(s, 'EXPAND', 200).state;
    expect(s.active.has('SHRINK')).toBe(false);
    expect(s.active.has('EXPAND')).toBe(true);
    expect(s.paddleScale).toBe(PADDLE_SCALE_EXPAND);
  });

  it('re-collect refreshes timer without double-applying scale', () => {
    let s = createPowerUpState(3);
    s = applyPowerUp(s, 'STICKY', 0).state;
    const firstExp = s.expiresAt.get('STICKY');
    const r = applyPowerUp(s, 'STICKY', 5000);
    expect(r.refreshed).toBe(true);
    expect(r.state.expiresAt.get('STICKY')).toBe(5000 + POWERUP_DURATION_MS);
    expect(r.state.expiresAt.get('STICKY')).not.toBe(firstExp);
    expect(r.state.sticky).toBe(true);
  });

  it('EXTRA_LIFE caps at MAX_LIVES', () => {
    let s = createPowerUpState(MAX_LIVES);
    const r = applyPowerUp(s, 'EXTRA_LIFE', 0);
    expect(r.gainedLife).toBe(false);
    expect(r.state.lives).toBe(MAX_LIVES);

    s = createPowerUpState(2);
    const r2 = applyPowerUp(s, 'EXTRA_LIFE', 0);
    expect(r2.gainedLife).toBe(true);
    expect(r2.state.lives).toBe(3);
  });

  it('MULTIBALL flags spawn without changing timed state', () => {
    const s0 = createPowerUpState(3);
    const r = applyPowerUp(s0, 'MULTIBALL', 0);
    expect(r.spawnMultiball).toBe(true);
    expect(r.state.active.size).toBe(0);
  });

  it('FIREBALL sets fireball flag', () => {
    const r = applyPowerUp(createPowerUpState(3), 'FIREBALL', 0);
    expect(r.state.fireball).toBe(true);
    expect(r.state.active.has('FIREBALL')).toBe(true);
  });

  it('LASER sets laser flag (timed, refreshable)', () => {
    let s = createPowerUpState(3);
    const first = applyPowerUp(s, 'LASER', 0, 10000);
    expect(first.state.laser).toBe(true);
    expect(first.state.active.has('LASER')).toBe(true);
    const second = applyPowerUp(first.state, 'LASER', 5000, 10000);
    expect(second.refreshed).toBe(true);
    expect(second.state.expiresAt.get('LASER')).toBe(15000);
  });

  it('SLOW sets slow flag', () => {
    const r = applyPowerUp(createPowerUpState(3), 'SLOW', 0, 8000);
    expect(r.state.slow).toBe(true);
    expect(r.state.active.has('SLOW')).toBe(true);
    expect(r.state.expiresAt.get('SLOW')).toBe(8000);
  });

  it('EXPLODE sets explode flag', () => {
    const r = applyPowerUp(createPowerUpState(3), 'EXPLODE', 0, 9000);
    expect(r.state.explode).toBe(true);
    expect(r.state.active.has('EXPLODE')).toBe(true);
  });
});

describe('laserMuzzleXs', () => {
  it('places muzzles near left and right paddle ends', () => {
    const m = laserMuzzleXs(400, 120, 6);
    expect(m.left).toBe(400 - 60 + 6);
    expect(m.right).toBe(400 + 60 - 6);
  });
});

describe('tickPowerUpExpiry', () => {
  it('expires timed effects and reverts paddle', () => {
    let s = createPowerUpState(3);
    s = applyPowerUp(s, 'EXPAND', 0, 1000).state;
    expect(s.paddleScale).toBe(PADDLE_SCALE_EXPAND);
    s = tickPowerUpExpiry(s, 1000);
    expect(s.active.has('EXPAND')).toBe(false);
    expect(s.paddleScale).toBe(PADDLE_SCALE_NORMAL);
  });

  it('does not expire before duration', () => {
    let s = createPowerUpState(3);
    s = applyPowerUp(s, 'STICKY', 0, 1000).state;
    s = tickPowerUpExpiry(s, 999);
    expect(s.sticky).toBe(true);
  });
});

describe('resetPowerUpState', () => {
  it('clears all effects and reverts scale', () => {
    let s = createPowerUpState(5);
    s = applyPowerUp(s, 'EXPAND', 0).state;
    s = applyPowerUp(s, 'FIREBALL', 0).state;
    s = applyPowerUp(s, 'STICKY', 0).state;
    s = resetPowerUpState(s);
    expect(s.active.size).toBe(0);
    expect(s.paddleScale).toBe(PADDLE_SCALE_NORMAL);
    expect(s.sticky).toBe(false);
    expect(s.fireball).toBe(false);
    expect(s.laser).toBe(false);
    expect(s.slow).toBe(false);
    expect(s.explode).toBe(false);
    expect(s.lives).toBe(5);
  });
});
