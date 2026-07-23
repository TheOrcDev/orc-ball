import Phaser from 'phaser';
import {
  BALL_RADIUS,
  COLORS,
  DEFAULT_BALL_SPEED,
  PADDLE_VELOCITY_TRANSFER,
  STEER_MAX_DEG,
} from '../config';
import { normalizeSpeedWithMinAxes } from '../logic/velocity';
import { paddleHitVelocity } from '../logic/steering';

export class Ball extends Phaser.Physics.Arcade.Image {
  speed = DEFAULT_BALL_SPEED;
  isFireball = false;
  stuckToPaddle = false;
  stuckOffsetX = 0;
  stuckSince = 0;
  /** Timestamp of last steered paddle bounce (cooldown against re-hits). */
  lastPaddleHitAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'ball');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Texture size === gameplay size (no setDisplaySize) so body scale stays 1:1
    this.setOrigin(0.5, 0.5);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(BALL_RADIUS);
    body.setOffset(0, 0);
    // Bounce is overridden on paddle hits; kept for walls/bricks
    body.setBounce(1, 1);
    body.setCollideWorldBounds(true);
    body.onWorldBounds = true;
  }

  stickTo(paddleX: number, paddleTopY: number, offsetX = 0, now = 0): void {
    this.stuckToPaddle = true;
    this.stuckOffsetX = offsetX;
    this.stuckSince = now;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.setVelocity(0, 0);
    this.x = paddleX + offsetX;
    this.y = paddleTopY - BALL_RADIUS - 1;
    this.clearFireballVisualIfNeeded();
  }

  followPaddle(paddleX: number, paddleTopY: number): void {
    if (!this.stuckToPaddle) return;
    this.x = paddleX + this.stuckOffsetX;
    this.y = paddleTopY - BALL_RADIUS - 1;
  }

  launchFromPaddle(
    paddleX: number,
    paddleDisplayWidth: number,
    paddleVelocityX = 0,
  ): void {
    if (!this.stuckToPaddle) return;
    this.stuckToPaddle = false;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    const { vx, vy } = paddleHitVelocity(
      this.x,
      paddleX,
      paddleDisplayWidth,
      this.speed,
      STEER_MAX_DEG,
      paddleVelocityX,
      PADDLE_VELOCITY_TRANSFER,
    );
    body.setVelocity(vx, vy);
    this.lastPaddleHitAt = this.scene.time.now;
  }

  /**
   * DX-Ball bounce: angle from hit position on paddle (left → left, right → right).
   * Ignores arcade surface reflection so edge hits always go that direction.
   */
  applyPaddleHit(
    paddleX: number,
    paddleDisplayWidth: number,
    paddleVelocityX = 0,
    now = 0,
  ): void {
    if (this.stuckToPaddle) return;
    const { vx, vy } = paddleHitVelocity(
      this.x,
      paddleX,
      paddleDisplayWidth,
      this.speed,
      STEER_MAX_DEG,
      paddleVelocityX,
      PADDLE_VELOCITY_TRANSFER,
    );
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(vx, vy);
    this.lastPaddleHitAt = now || this.scene.time.now;
  }

  maintainSpeed(): void {
    if (this.stuckToPaddle) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body.enable) return;
    const v = normalizeSpeedWithMinAxes(
      body.velocity.x,
      body.velocity.y,
      this.speed,
    );
    body.setVelocity(v.x, v.y);
  }

  setFireball(active: boolean): void {
    this.isFireball = active;
    if (active) {
      this.setTint(COLORS.fireTint);
    } else {
      this.clearTint();
    }
  }

  private clearFireballVisualIfNeeded(): void {
    if (!this.isFireball) this.clearTint();
  }

  launchWithVelocity(vx: number, vy: number): void {
    this.stuckToPaddle = false;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(vx, vy);
    this.maintainSpeed();
  }
}
