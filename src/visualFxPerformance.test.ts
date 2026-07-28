import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string): string =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('visual FX performance structure', () => {
  it('uses the baked power-up glyph without a companion Text object', () => {
    const powerUp = readSource('./objects/PowerUp.ts');
    const gameScene = readSource('./scenes/GameScene.ts');

    expect(powerUp).not.toMatch(/scene\.add\s*\.text/);
    expect(powerUp).not.toContain('letterLabel');
    expect(gameScene).not.toContain('syncLabel');
  });

  it('starts and stops the fire trail only when its target changes', () => {
    const gameScene = readSource('./scenes/GameScene.ts');

    expect(gameScene).toContain('fireBall !== this.fireTrailTarget');
    expect(gameScene.match(/fireTrailEmitter\.startFollow/g)).toHaveLength(1);
  });

  it('uses baked glue art and throttles the preallocated laser overlay', () => {
    const paddle = readSource('./objects/Paddle.ts');

    expect(paddle).toContain('OVERLAY_REDRAW_INTERVAL_MS');
    expect(paddle).toContain('advanceFxRedrawClock');
    expect(paddle).toContain("setTexture('paddle-glue')");
    expect(paddle).not.toContain('redrawGlueOverlay');
    expect(paddle).toMatch(/this\.laserOverlay = scene\.add/);
  });

  it('builds static board themes during setup, not effect switching', () => {
    const boardFx = readSource('./systems/BoardFx.ts');

    expect(boardFx).toContain('STATIC_THEME_IDS');
    expect(boardFx).toContain('staticLayers');
    expect(boardFx.match(/this\.redrawStatic\(/g)).toHaveLength(1);
    expect(boardFx).toContain('shouldReconfigureParticleStyle');
  });
});
