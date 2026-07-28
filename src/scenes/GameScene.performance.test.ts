import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(import.meta.dirname, 'GameScene.ts'), 'utf8');

function between(start: string, end: string): string {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt);
  if (startAt < 0 || endAt < 0) return '';
  return source.slice(startAt, endAt);
}

describe('GameScene performance guardrails', () => {
  it('keeps power-up side effects out of the Arcade overlap callback', () => {
    const callback = between(
      'private onCollectPowerUp',
      'private powerUpToastColor',
    );

    expect(callback).toContain('queuePowerUpCollection');
    expect(callback).not.toContain('powerUpManager.collect');
    expect(callback).not.toContain('showPowerUpToast');
  });

  it('applies queued collections from deferred post-update work', () => {
    const deferred = between(
      'private flushDeferredWork',
      '/**\n   * Schedule level clear',
    );

    expect(deferred).toContain('pendingCollections');
    expect(deferred).toContain('powerUpManager.collect');
    expect(deferred).toContain('showPowerUpToast');
  });

  it('publishes timed HUD effects as one registry snapshot', () => {
    expect(source).toContain("registry.set('effectSnapshot'");
    expect(source).not.toMatch(/registry\.set\('effect(?:Glue|Bullet|Laser|Slow|Explode)/);
  });

  it('drains every queued logical pickup in FIFO order', () => {
    const deferred = between(
      'private flushDeferredWork',
      '/**\n   * Schedule level clear',
    );

    expect(deferred).toContain('pendingCollections.splice(0)');
    expect(deferred).not.toContain('MAX_COLLECTIONS_PER_FRAME');
  });

  it('caps both drop creation and object destruction per frame', () => {
    const deferred = between(
      'private flushDeferredWork',
      '/**\n   * Schedule level clear',
    );

    expect(deferred).toContain('MAX_DROP_SPAWNS_PER_FRAME');
    expect(deferred).toContain('MAX_DESTROYS_PER_FRAME');
  });

  it('does not carry queued brick drops into a new life', () => {
    const lifeLost = between(
      'private onLifeLost',
      'private onGameOver',
    );

    expect(lifeLost).toContain('pendingDrops.length = 0');
  });

  it('pre-rasterizes and reuses pickup toasts', () => {
    const toast = between(
      'private createPowerUpToasts',
      '/** Reuse a pre-rasterized floating pickup label.',
    );
    const showToast = between(
      'private showPowerUpToast',
      '/**\n   * MULTIBALL',
    );

    expect(toast).toContain('Object.entries(POWERUP_LABEL)');
    expect(showToast).toContain('this.powerUpToasts.get(type)');
    expect(showToast).not.toContain('this.add');
    expect(showToast).not.toContain('setText');
  });
});
