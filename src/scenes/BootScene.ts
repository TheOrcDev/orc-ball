import Phaser from 'phaser';
import {
  BALL_DIAMETER,
  BALL_RADIUS,
  BRICK_HEIGHT,
  BRICK_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  POWERUP_SIZE,
} from '../config';
import type { PowerUpType } from '../data/types';
import { POWERUP_COLOR, POWERUP_LETTER } from '../objects/PowerUp';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.generateTextures();
    this.scene.start('MenuScene');
  }

  private generateTextures(): void {
    this.bakePaddle();
    this.bakeBall();
    this.bakeBrick();
    this.bakeParticle();

    const types: PowerUpType[] = [
      'EXPAND',
      'SHRINK',
      'MULTIBALL',
      'STICKY',
      'FIREBALL',
      'EXTRA_LIFE',
    ];

    for (const type of types) {
      const texKey =
        type === 'EXTRA_LIFE'
          ? 'powerup-extralife'
          : type === 'MULTIBALL'
            ? 'powerup-multiball'
            : type === 'FIREBALL'
              ? 'powerup-fireball'
              : type === 'EXPAND'
                ? 'powerup-expand'
                : type === 'SHRINK'
                  ? 'powerup-shrink'
                  : 'powerup-sticky';

      this.bakePowerUpTexture(texKey, POWERUP_COLOR[type], POWERUP_LETTER[type]);
    }
  }

  /** Beveled 3D-ish paddle with highlight rim. */
  private bakePaddle(): void {
    const w = PADDLE_WIDTH;
    const h = PADDLE_HEIGHT;
    const g = this.make.graphics({ x: 0, y: 0 });
    // Base body
    g.fillStyle(0x4fc3f7, 1);
    g.fillRoundedRect(0, 0, w, h, 6);
    // Top highlight (light source upper-left)
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(2, 1, w - 4, h * 0.4, 4);
    // Bottom shadow lip
    g.fillStyle(0x01579b, 0.55);
    g.fillRect(2, h - 5, w - 4, 4);
    // Side bevels
    g.fillStyle(0x81d4fa, 0.5);
    g.fillRect(1, 3, 3, h - 6);
    g.fillStyle(0x0277bd, 0.45);
    g.fillRect(w - 4, 3, 3, h - 6);
    // Energy strip
    g.fillStyle(0xe1f5fe, 0.7);
    g.fillRect(10, h / 2 - 1, w - 20, 2);
    g.generateTexture('paddle', w, h);
    g.destroy();
  }

  /** Sphere with specular highlight. */
  private bakeBall(): void {
    const d = BALL_DIAMETER;
    const r = BALL_RADIUS;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xe8eaf6, 1);
    g.fillCircle(r, r, r);
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(r - 2, r - 2, r * 0.35);
    g.fillStyle(0x90a4ae, 0.35);
    g.fillCircle(r + 2, r + 3, r * 0.45);
    g.generateTexture('ball', d, d);
    g.destroy();
  }

  /**
   * White brick with 3D bevel — tinted at runtime per HP.
   * Highlight TL, shadow BR, inner face.
   */
  private bakeBrick(): void {
    const w = BRICK_WIDTH;
    const h = BRICK_HEIGHT;
    const g = this.make.graphics({ x: 0, y: 0 });
    // Face
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, w, h, 4);
    // Top highlight edge
    g.fillStyle(0xffffff, 0.55);
    g.fillRect(3, 2, w - 6, 4);
    // Left highlight
    g.fillStyle(0xffffff, 0.28);
    g.fillRect(2, 4, 4, h - 8);
    // Bottom shadow
    g.fillStyle(0x000000, 0.28);
    g.fillRect(3, h - 6, w - 6, 4);
    // Right shadow
    g.fillStyle(0x000000, 0.2);
    g.fillRect(w - 6, 4, 4, h - 8);
    // Inner groove
    g.lineStyle(1, 0x000000, 0.12);
    g.strokeRoundedRect(3, 3, w - 6, h - 6, 3);
    // Specular corner
    g.fillStyle(0xffffff, 0.4);
    g.fillTriangle(4, 4, 14, 4, 4, 12);
    g.generateTexture('brick', w, h);
    g.destroy();
  }

  private bakeParticle(): void {
    const partG = this.make.graphics({ x: 0, y: 0 });
    partG.fillStyle(0xffffff, 1);
    partG.fillCircle(4, 4, 4);
    partG.generateTexture('particle', 8, 8);
    partG.destroy();
  }

  private bakePowerUpTexture(
    key: string,
    color: number,
    letter: string,
  ): void {
    const size = POWERUP_SIZE;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, size, size, 5);
    // Bevel
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(2, 2, size - 4, 5);
    g.fillStyle(0x000000, 0.25);
    g.fillRect(2, size - 6, size - 4, 4);
    g.lineStyle(2, 0xffffff, 0.7);
    g.strokeRoundedRect(1, 1, size - 2, size - 2, 5);

    const label = this.add
      .text(size / 2, size / 2, letter, {
        fontFamily: 'monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setVisible(false);

    const rt = this.make.renderTexture({
      x: 0,
      y: 0,
      width: size,
      height: size,
    });
    rt.draw(g, 0, 0);
    rt.draw(label, 0, 0);
    rt.saveTexture(key);
    rt.destroy();
    label.destroy();
    g.destroy();
  }
}
