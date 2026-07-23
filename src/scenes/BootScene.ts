import Phaser from 'phaser';
import {
  BALL_RADIUS,
  BRICK_HEIGHT,
  BRICK_WIDTH,
  LASER_HEIGHT,
  LASER_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  POWERUP_SIZE,
} from '../config';
import { ALL_POWER_UP_TYPES, type PowerUpType } from '../data/types';
import { POWERUP_COLOR, POWERUP_LETTER } from '../objects/PowerUp';

const POWERUP_TEX: Record<PowerUpType, string> = {
  EXPAND: 'powerup-expand',
  SHRINK: 'powerup-shrink',
  MULTIBALL: 'powerup-multiball',
  STICKY: 'powerup-sticky',
  FIREBALL: 'powerup-fireball',
  EXTRA_LIFE: 'powerup-extralife',
  LASER: 'powerup-laser',
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // Title / landing art from public/
    this.load.image('menu-bg', 'orc-ball-landing.jpg');
    // Soundtracks (prefer mp3 for size; see public/audio/)
    this.load.audio('music-menu', 'audio/orc-ball-menu-moonlit-cartridge.mp3');
    this.load.audio(
      'music-coin-op',
      'audio/orc-ball-gameplay-coin-op-chase.mp3',
    );
    this.load.audio(
      'music-danger',
      'audio/orc-ball-danger-one-heart-left.mp3',
    );
    this.load.audio(
      'music-level-clear',
      'audio/orc-ball-level-clear-gem-secured.mp3',
    );
    this.load.audio('music-binary-eagle', 'audio/binary-eagle.mp3');
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
    this.bakeLaser();

    for (const type of ALL_POWER_UP_TYPES) {
      this.bakePowerUpTexture(
        POWERUP_TEX[type],
        POWERUP_COLOR[type],
        POWERUP_LETTER[type],
      );
    }
  }

  /** Bright red laser bolt (fires upward from paddle ends). */
  private bakeLaser(): void {
    const w = LASER_WIDTH;
    const h = LASER_HEIGHT;
    const g = this.make.graphics({ x: 0, y: 0 });
    // Outer glow
    g.fillStyle(0xff1744, 0.5);
    g.fillRoundedRect(0, 0, w, h, 2);
    // Core
    g.fillStyle(0xff5252, 1);
    g.fillRect(1, 0, Math.max(1, w - 2), h);
    // Hot white center
    g.fillStyle(0xffffff, 0.95);
    g.fillRect(Math.floor(w / 2) - 0.5, 0, 2, h);
    g.generateTexture('laser', w, h);
    g.destroy();
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

    // Sticky / GLUE paddle — slime coating + baked drips
    this.bakeGluePaddle();
  }

  /** Player paddle when GLUE is active: viscous green slime look. */
  private bakeGluePaddle(): void {
    const w = PADDLE_WIDTH;
    const bodyH = PADDLE_HEIGHT;
    // Extra height for hanging drips under the paddle
    const dripH = 18;
    const h = bodyH + dripH;
    const g = this.make.graphics({ x: 0, y: 0 });

    // Slime body
    g.fillStyle(0x7cb342, 1);
    g.fillRoundedRect(0, 0, w, bodyH, 7);
    // Glossy top
    g.fillStyle(0xc6ff00, 0.55);
    g.fillRoundedRect(2, 1, w - 4, bodyH * 0.45, 5);
    // Sticky sheen stripe
    g.fillStyle(0xeeff41, 0.7);
    g.fillRect(8, bodyH / 2 - 2, w - 16, 3);
    // Darker goo underside
    g.fillStyle(0x33691e, 0.75);
    g.fillRect(2, bodyH - 6, w - 4, 5);
    // Side blobs
    g.fillStyle(0xaeea00, 0.6);
    g.fillCircle(4, bodyH / 2, 5);
    g.fillCircle(w - 4, bodyH / 2, 5);

    // Hanging drips along bottom (part of texture, origin still mid-body)
    const dripXs = [14, 32, 50, 70, 88, 106];
    for (let i = 0; i < dripXs.length; i++) {
      const dx = dripXs[i]!;
      const len = 8 + (i % 3) * 4;
      g.fillStyle(0x9ccc65, 0.95);
      g.fillTriangle(dx - 4, bodyH - 2, dx + 4, bodyH - 2, dx, bodyH + len);
      g.fillStyle(0xc6ff00, 0.8);
      g.fillCircle(dx, bodyH + len, 3.5);
      g.fillStyle(0xffffff, 0.2);
      g.fillCircle(dx - 1, bodyH + len * 0.5, 1.5);
    }

    g.generateTexture('paddle-glue', w, h);
    g.destroy();
  }

  /** Simple light ball with soft highlight — native size for 1:1 physics. */
  private bakeBall(): void {
    const r = BALL_RADIUS;
    const d = BALL_RADIUS * 2;
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
    g.fillRoundedRect(0, 0, size, size, 6);
    // Bevel
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(3, 2, size - 6, 7);
    g.fillStyle(0x000000, 0.28);
    g.fillRect(3, size - 8, size - 6, 5);
    g.lineStyle(2, 0xffffff, 0.85);
    g.strokeRoundedRect(1, 1, size - 2, size - 2, 6);

    // Bold letter centered on capsule (draw at size/2 — NOT 0,0)
    const label = this.make
      .text({
        x: size / 2,
        y: size / 2,
        text: letter,
        style: {
          fontFamily: 'monospace',
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 6,
        },
      })
      .setOrigin(0.5);

    const rt = this.make.renderTexture({
      x: 0,
      y: 0,
      width: size,
      height: size,
    });
    rt.clear();
    rt.draw(g, 0, 0);
    // Use the text object's own x/y (center) — passing 0,0 clipped the glyph
    rt.draw(label);
    rt.saveTexture(key);
    rt.destroy();
    label.destroy();
    g.destroy();
  }
}
