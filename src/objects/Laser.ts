import Phaser from 'phaser';
import { LASER_SPEED } from '../config';

/** Upward laser bolt fired from a paddle end. */
export class Laser extends Phaser.Physics.Arcade.Image {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'laser');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setDepth(12);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocity(0, -LASER_SPEED);
    body.setCollideWorldBounds(false);
  }
}
