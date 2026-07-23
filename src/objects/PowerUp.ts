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
  /** Floating letter follows the capsule (readable even if texture bake fails). */
  private letterLabel?: Phaser.GameObjects.Text;

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

    // Live letter on top of the colored capsule — always visible
    this.letterLabel = scene.add
      .text(x, y, POWERUP_LETTER[type], {
        fontFamily: 'monospace',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(26);
  }

  /** Keep letter locked to the falling capsule. */
  syncLabel(): void {
    if (!this.letterLabel) return;
    if (!this.active || !this.visible) {
      this.letterLabel.setVisible(false);
      return;
    }
    this.letterLabel.setVisible(true);
    this.letterLabel.setPosition(this.x, this.y);
  }

  destroy(fromScene?: boolean): void {
    this.letterLabel?.destroy();
    this.letterLabel = undefined;
    super.destroy(fromScene);
  }

  static textureKey(type: PowerUpType): string {
    return TEXTURE_BY_TYPE[type];
  }
}
