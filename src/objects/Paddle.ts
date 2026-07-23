import Phaser from 'phaser';
import {
  HEIGHT,
  PADDLE_SCALE_NORMAL,
  PADDLE_SPEED,
  PADDLE_Y,
  WIDTH,
} from '../config';
import { paddleBodySetSizeArgs } from '../logic/paddleBody';

export class Paddle extends Phaser.Physics.Arcade.Sprite {
  sticky = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private moveSpeed = PADDLE_SPEED;

  constructor(scene: Phaser.Scene, x?: number, y?: number) {
    super(scene, x ?? WIDTH / 2, y ?? PADDLE_Y, 'paddle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setImmovable(true);
    this.setCollideWorldBounds(true);
    this.setOrigin(0.5, 0.5);
    this.setScale(PADDLE_SCALE_NORMAL);
    this.syncBodySize();

    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  }

  /**
   * Phaser Arcade Body.setSize stores unscaled source size then multiplies by
   * scaleX/Y — pass frame width/height (this.width/height), NOT displayWidth.
   * center=true (default) keeps the body centered on the sprite.
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

  update(_time: number, _delta: number): void {
    let dir = 0;
    if (this.cursors.left?.isDown || this.keyA.isDown) dir -= 1;
    if (this.cursors.right?.isDown || this.keyD.isDown) dir += 1;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(dir * this.moveSpeed);

    // Extra clamp so half-width never leaves the world
    const half = this.displayWidth / 2;
    if (this.x < half) {
      this.x = half;
      body.setVelocityX(Math.max(0, body.velocity.x));
    } else if (this.x > WIDTH - half) {
      this.x = WIDTH - half;
      body.setVelocityX(Math.min(0, body.velocity.x));
    }

    // Keep Y locked
    this.y = PADDLE_Y;
    body.setVelocityY(0);
  }

  /** Useful for tests / debug without keyboard. */
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
