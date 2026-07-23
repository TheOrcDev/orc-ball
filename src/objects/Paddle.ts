import Phaser from 'phaser';
import {
  HEIGHT,
  PADDLE_SCALE_NORMAL,
  PADDLE_SPEED,
  PADDLE_Y,
  WIDTH,
} from '../config';
import { paddleBodySetSizeArgs } from '../logic/paddleBody';
import { clampPaddleX } from '../logic/touch';

export class Paddle extends Phaser.Physics.Arcade.Sprite {
  sticky = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private moveSpeed = PADDLE_SPEED;
  /** When set, paddle tracks this world X (touch/mouse drag). */
  private pointerTargetX: number | null = null;
  /** Smoothed horizontal velocity for ball english when pointer-steering. */
  private pointerVelX = 0;

  constructor(scene: Phaser.Scene, x?: number, y?: number) {
    super(scene, x ?? WIDTH / 2, y ?? PADDLE_Y, 'paddle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setImmovable(true);
    this.setCollideWorldBounds(true);
    this.setOrigin(0.5, 0.5);
    this.setScale(PADDLE_SCALE_NORMAL);
    this.syncBodySize();

    const kb = scene.input.keyboard;
    if (kb) {
      this.cursors = kb.createCursorKeys();
      this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    }
  }

  /**
   * Phaser Arcade Body.setSize stores unscaled source size then multiplies by
   * scaleX/Y — pass frame width/height (this.width/height), NOT displayWidth.
   */
  syncBodySize(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const { width, height } = paddleBodySetSizeArgs(this.width, this.height);
    body.setSize(width, height, true);
  }

  setWidthScale(scale: number): void {
    this.setScale(scale);
    this.syncBodySize();
  }

  resetWidth(): void {
    this.setWidthScale(PADDLE_SCALE_NORMAL);
  }

  /** Follow finger/cursor X, or null to return to keyboard control. */
  setPointerTargetX(x: number | null): void {
    this.pointerTargetX = x;
    if (x === null) this.pointerVelX = 0;
  }

  get hasPointerTarget(): boolean {
    return this.pointerTargetX !== null;
  }

  /** Horizontal velocity used for ball spin transfer (keyboard or pointer). */
  getHorizontalVelocity(): number {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (this.pointerTargetX !== null) return this.pointerVelX;
    return body?.velocity.x ?? 0;
  }

  update(_time: number, delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const half = this.displayWidth / 2;
    const dt = Math.max(delta, 1) / 1000;

    if (this.pointerTargetX !== null) {
      const target = clampPaddleX(this.pointerTargetX, half, WIDTH);
      const prevX = this.x;
      // Snappy follow — responsive on touch
      const blend = 1 - Math.exp(-18 * dt);
      this.x = prevX + (target - prevX) * blend;
      this.pointerVelX = (this.x - prevX) / dt;
      body.setVelocityX(this.pointerVelX);
    } else {
      let dir = 0;
      if (this.cursors?.left?.isDown || this.keyA?.isDown) dir -= 1;
      if (this.cursors?.right?.isDown || this.keyD?.isDown) dir += 1;
      body.setVelocityX(dir * this.moveSpeed);
      this.pointerVelX = body.velocity.x;
    }

    // Extra clamp so half-width never leaves the world
    if (this.x < half) {
      this.x = half;
      body.setVelocityX(Math.max(0, body.velocity.x));
      this.pointerVelX = body.velocity.x;
    } else if (this.x > WIDTH - half) {
      this.x = WIDTH - half;
      body.setVelocityX(Math.min(0, body.velocity.x));
      this.pointerVelX = body.velocity.x;
    }

    // Keep Y locked
    this.y = PADDLE_Y;
    body.setVelocityY(0);
  }

  get boundsLeft(): number {
    return this.displayWidth / 2;
  }

  get boundsRight(): number {
    return WIDTH - this.displayWidth / 2;
  }

  get paddleY(): number {
    return HEIGHT - 40;
  }
}
