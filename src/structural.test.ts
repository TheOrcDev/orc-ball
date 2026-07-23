/**
 * Structural audit: must-have terms exist in shipped source and are wired.
 * These are file-content assertions (not re-implementations of game logic).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

function readAll(): string {
  return walk(SRC)
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
}

describe('structural audit of shipped source', () => {
  const src = readAll();
  const main = readFileSync(join(SRC, 'main.ts'), 'utf8');
  const game = readFileSync(join(SRC, 'scenes/GameScene.ts'), 'utf8');
  const boot = readFileSync(join(SRC, 'scenes/BootScene.ts'), 'utf8');
  const sfx = readFileSync(join(SRC, 'systems/Sfx.ts'), 'utf8');
  const pum = readFileSync(join(SRC, 'systems/PowerUpManager.ts'), 'utf8');
  const levels = readFileSync(join(SRC, 'data/levels.ts'), 'utf8');
  const types = readFileSync(join(SRC, 'data/types.ts'), 'utf8');
  const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const vite = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');

  it('has Phaser arcade gravity 0,0 and scale FIT + CENTER_BOTH', () => {
    expect(main).toMatch(/gravity:\s*\{\s*x:\s*0,\s*y:\s*0\s*\}/);
    expect(main).toMatch(/Phaser\.Scale\.FIT/);
    expect(main).toMatch(/Phaser\.Scale\.CENTER_BOTH/);
    expect(main).toMatch(/BootScene/);
    expect(main).toMatch(/MenuScene/);
    expect(main).toMatch(/GameScene/);
    expect(main).toMatch(/UIScene/);
  });

  it('has keyboard bindings and capture', () => {
    expect(src).toMatch(/KeyCodes\.SPACE|addKey\(.*SPACE/);
    expect(src).toMatch(/LEFT|createCursorKeys/);
    expect(src).toMatch(/KeyCodes\.A/);
    expect(src).toMatch(/KeyCodes\.D/);
    expect(src).toMatch(/addCapture\(['"]SPACE,LEFT,RIGHT,A,D['"]\)/);
  });

  it('has open-bottom bounds collision', () => {
    expect(game).toMatch(/setBoundsCollision\(\s*true,\s*true,\s*true,\s*false\s*\)/);
  });

  it('has group colliders balls↔paddle, balls↔bricks with processCallback, powerUps overlap', () => {
    expect(game).toMatch(/physics\.add\.collider\(\s*this\.balls,\s*this\.paddle/);
    expect(game).toMatch(/physics\.add\.collider\(\s*this\.balls,\s*this\.bricks/);
    expect(game).toMatch(/processBallBrick/);
    expect(game).toMatch(/physics\.add\.overlap\(\s*this\.powerUps,\s*this\.paddle/);
  });

  it('has LevelDef-driven levels (4–6)', () => {
    expect(types).toMatch(/interface LevelDef/);
    expect(levels).toMatch(/export const LEVELS/);
    const names = levels.match(/name:\s*'/g);
    expect(names?.length).toBeGreaterThanOrEqual(4);
    expect(names?.length).toBeLessThanOrEqual(6);
  });

  it('has all six power-up types and PowerUpManager reset/timed rules', () => {
    for (const t of [
      'EXPAND',
      'SHRINK',
      'MULTIBALL',
      'STICKY',
      'FIREBALL',
      'EXTRA_LIFE',
    ]) {
      expect(types).toContain(t);
      expect(pum + readFileSync(join(SRC, 'logic/powerUpState.ts'), 'utf8')).toContain(
        t === 'MULTIBALL' || t === 'EXTRA_LIFE' ? t : t,
      );
    }
    expect(pum).toMatch(/reset\(/);
    expect(pum).toMatch(/scheduleTimed|delayedCall/);
  });

  it('generates textures at runtime and synthesizes SFX via WebAudio', () => {
    expect(boot).toMatch(/generateTexture/);
    expect(boot).toMatch(/'paddle'/);
    expect(boot).toMatch(/'ball'/);
    expect(boot).toMatch(/'brick'/);
    expect(sfx).toMatch(/AudioContext|createOscillator|getAudioContext/);
    expect(sfx).toMatch(/tryUnlock|UNLOCKED|locked/);
  });

  it('has particles, shake, and separate UIScene HUD', () => {
    expect(game).toMatch(/particles/);
    expect(game).toMatch(/shake\(/);
    expect(game).toMatch(/scene\.launch\(['"]UIScene['"]\)/);
    expect(src).toMatch(/changedata/);
  });

  it('has BoardFx electricity and power-reactive themes', () => {
    expect(src).toMatch(/BoardFx/);
    expect(src).toMatch(/fxTheme|resolveFxThemeId|getFxTheme/);
    expect(src).toMatch(/crackleAt|setEffects/);
  });

  it('index.html mounts #game on black body; vite base and phaser chunk', () => {
    expect(index).toMatch(/id="game"/);
    expect(index).toMatch(/background:\s*#000/);
    expect(vite).toMatch(/base:\s*['"](\.\/|\/)['"]/);
    expect(vite).toMatch(/phaser/);
  });

  it('has object and system modules', () => {
    for (const f of [
      'objects/Paddle.ts',
      'objects/Ball.ts',
      'objects/Brick.ts',
      'objects/PowerUp.ts',
      'systems/PowerUpManager.ts',
      'systems/Sfx.ts',
      'scenes/BootScene.ts',
      'scenes/MenuScene.ts',
      'scenes/GameScene.ts',
      'scenes/UIScene.ts',
    ]) {
      expect(() => readFileSync(join(SRC, f), 'utf8')).not.toThrow();
    }
  });
});
