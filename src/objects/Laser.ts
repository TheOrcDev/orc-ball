import Phaser from 'phaser';
import { LASER_HEIGHT, LASER_SPEED, LASER_WIDTH } from '../config';

/**
 * Upward laser bolt fired from a paddle end.
 * Physics is applied via arm() after the object is in a physics group —
 * group.add() can reset body velocity if set too early.
 */
export class Laser extends Phaser.Physics.Arcade.Image {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'laser');
    scene.add.existing(this);
    this.setOrigin(0.5, 0.5);
    this.setDepth(50);
    this.setActive(true);
    this.setVisible(true);
  }

  /** Enable body and launch upward. Call after adding to a physics group. */
  arm(): void {
    if (!this.body) {
      this.scene.physics.add.existing(this);
    }
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setAllowGravity(false);
    body.setCollideWorldBounds(false);
    body.setSize(LASER_WIDTH, LASER_HEIGHT);
    body.setVelocity(0, -LASER_SPEED);
    // Keep sprite motion linked
    body.moves = true;
  }
}
