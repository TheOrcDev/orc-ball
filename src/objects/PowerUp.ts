import Phaser from 'phaser';
import { COLORS, POWERUP_FALL_SPEED } from '../config';
import type { PowerUpType } from '../data/types';

const TEXTURE_BY_TYPE: Record<PowerUpType, string> = {
  EXPAND: 'powerup-expand',
  SHRINK: 'powerup-shrink',
  MULTIBALL: 'powerup-multiball',
  STICKY: 'powerup-sticky',
  FIREBALL: 'powerup-fireball',
  EXTRA_LIFE: 'powerup-extralife',
  LASER: 'powerup-laser',
  SLOW: 'powerup-slow',
  EXPLODE: 'powerup-explode',
};

export const POWERUP_COLOR: Record<PowerUpType, number> = {
  EXPAND: COLORS.expand,
  SHRINK: COLORS.shrink,
  MULTIBALL: COLORS.multiball,
  STICKY: COLORS.sticky,
  FIREBALL: COLORS.fireball,
  EXTRA_LIFE: COLORS.extraLife,
  LASER: COLORS.laser,
  SLOW: COLORS.slow,
  EXPLODE: COLORS.explode,
};

/** Player-facing names (STICKY = Glue, FIREBALL = Bullet, EXPLODE = Blast). */
export const POWERUP_LABEL: Record<PowerUpType, string> = {
  EXPAND: 'EXPAND',
  SHRINK: 'SHRINK',
  MULTIBALL: 'MULTI',
  STICKY: 'GLUE',
  FIREBALL: 'BULLET',
  EXTRA_LIFE: 'LIFE',
  LASER: 'LASER',
  SLOW: 'SLOW',
  EXPLODE: 'BLAST',
};

/**
 * Big letter painted on every falling drop.
 * L = Laser, G = Glue, B = Bullet, M = Multi, E = Expand, S = Shrink,
 * + = Life, W = sloW, ! = Blast.
 */
export const POWERUP_LETTER: Record<PowerUpType, string> = {
  EXPAND: 'E',
  SHRINK: 'S',
  MULTIBALL: 'M',
  STICKY: 'G',
  FIREBALL: 'B',
  EXTRA_LIFE: '+',
  LASER: 'L',
  SLOW: 'W',
  EXPLODE: '!',
};

export class PowerUp extends Phaser.Physics.Arcade.Image {
  powerType: PowerUpType = 'EXPAND';

  constructor(scene: Phaser.Scene, x: number, y: number, type: PowerUpType) {
    super(scene, x, y, TEXTURE_BY_TYPE[type]);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.powerType = type;
    this.setOrigin(0.5, 0.5);
    this.setDepth(25);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocity(0, POWERUP_FALL_SPEED);
    body.setCollideWorldBounds(false);
  }

  static textureKey(type: PowerUpType): string {
    return TEXTURE_BY_TYPE[type];
  }
}
