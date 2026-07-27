import { POWERUP_WARN_BLINK_MS, POWERUP_WARN_MS } from '../config';

/** Milliseconds left until expiry (0 if missing/expired). */
export function remainingMs(
  expiresAt: number | undefined,
  nowMs: number,
): number {
  if (expiresAt === undefined) return 0;
  return Math.max(0, expiresAt - nowMs);
}

/** True when an active timed effect is in its final warning window. */
export function isExpiringSoon(
  remaining: number,
  warnMs: number = POWERUP_WARN_MS,
): boolean {
  return remaining > 0 && remaining <= warnMs;
}

/**
 * Blink period shortens as expiry approaches so the last second feels urgent.
 */
export function expiryBlinkPeriodMs(
  remaining: number,
  baseMs: number = POWERUP_WARN_BLINK_MS,
): number {
  if (remaining <= 1000) return Math.max(80, Math.floor(baseMs * 0.45));
  if (remaining <= 2000) return Math.max(100, Math.floor(baseMs * 0.7));
  return baseMs;
}

/** 1 or ~0.3 alternating — use for HUD / paddle / ball alpha while warning. */
export function expiryBlinkAlpha(
  nowMs: number,
  remaining: number,
  basePeriodMs: number = POWERUP_WARN_BLINK_MS,
  dimAlpha = 0.28,
): number {
  if (!isExpiringSoon(remaining)) return 1;
  const period = expiryBlinkPeriodMs(remaining, basePeriodMs);
  return Math.floor(nowMs / period) % 2 === 0 ? 1 : dimAlpha;
}

/** Whole seconds left for HUD, e.g. "12s". */
export function formatSecondsLeft(remaining: number): string {
  const s = Math.max(0, Math.ceil(remaining / 1000));
  return `${s}s`;
}

export type TimedHudEffect = {
  label: string;
  remainingMs: number;
  hint?: string;
};

/**
 * Build the HUD effects line with per-effect countdowns.
 * Returns whether any effect is in the warning window (for blink).
 */
export function buildEffectsHud(
  effects: readonly TimedHudEffect[],
  warnMs: number = POWERUP_WARN_MS,
): { text: string; warning: boolean; minRemainingMs: number } {
  const active = effects.filter((e) => e.remainingMs > 0);
  let warning = false;
  let minRemainingMs = Number.POSITIVE_INFINITY;
  const parts: string[] = [];
  for (const e of active) {
    if (isExpiringSoon(e.remainingMs, warnMs)) warning = true;
    minRemainingMs = Math.min(minRemainingMs, e.remainingMs);
    const time = formatSecondsLeft(e.remainingMs);
    parts.push(e.hint ? `${e.label} ${time} (${e.hint})` : `${e.label} ${time}`);
  }
  return {
    text: parts.join('  ·  '),
    warning,
    minRemainingMs: active.length === 0 ? 0 : minRemainingMs,
  };
}
