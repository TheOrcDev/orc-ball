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
import { POWERUP_COLOR } from '../objects/PowerUp';

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

    // Power-up squares with letter marks
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

      const g = this.make.graphics({ x: 0, y: 0 });
      const color = POWERUP_COLOR[type];
      g.fillStyle(color, 1);
      g.fillRoundedRect(0, 0, POWERUP_SIZE, POWERUP_SIZE, 4);
      g.lineStyle(2, 0xffffff, 0.5);
      g.strokeRoundedRect(1, 1, POWERUP_SIZE - 2, POWERUP_SIZE - 2, 4);
      g.generateTexture(texKey, POWERUP_SIZE, POWERUP_SIZE);
      g.destroy();
    }
  }
}
