import Phaser from 'phaser';
import {
  BALL_DIAMETER,
  BALL_RADIUS,
  BRICK_HEIGHT,
  BRICK_WIDTH,
  COLORS,
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
    // Paddle
    const paddleG = this.make.graphics({ x: 0, y: 0 });
    paddleG.fillStyle(COLORS.paddle, 1);
    paddleG.fillRoundedRect(0, 0, PADDLE_WIDTH, PADDLE_HEIGHT, 6);
    paddleG.generateTexture('paddle', PADDLE_WIDTH, PADDLE_HEIGHT);
    paddleG.destroy();

    // Ball
    const ballG = this.make.graphics({ x: 0, y: 0 });
    ballG.fillStyle(COLORS.ball, 1);
    ballG.fillCircle(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS);
    ballG.generateTexture('ball', BALL_DIAMETER, BALL_DIAMETER);
    ballG.destroy();

    // White brick (tinted per type at runtime)
    const brickG = this.make.graphics({ x: 0, y: 0 });
    brickG.fillStyle(0xffffff, 1);
    brickG.fillRoundedRect(0, 0, BRICK_WIDTH, BRICK_HEIGHT, 3);
    brickG.lineStyle(1, 0x000000, 0.25);
    brickG.strokeRoundedRect(0.5, 0.5, BRICK_WIDTH - 1, BRICK_HEIGHT - 1, 3);
    brickG.generateTexture('brick', BRICK_WIDTH, BRICK_HEIGHT);
    brickG.destroy();

    // Particle (8×8 white)
    const partG = this.make.graphics({ x: 0, y: 0 });
    partG.fillStyle(0xffffff, 1);
    partG.fillRect(0, 0, 8, 8);
    partG.generateTexture('particle', 8, 8);
    partG.destroy();

    // Power-up squares with letter (G=Glue, B=Bullet, …)
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

  private bakePowerUpTexture(
    key: string,
    color: number,
    letter: string,
  ): void {
    const size = POWERUP_SIZE;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, size, size, 5);
    g.lineStyle(2, 0xffffff, 0.7);
    g.strokeRoundedRect(1, 1, size - 2, size - 2, 5);

    // make.text takes a config object; add.text uses x,y,string,style
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
