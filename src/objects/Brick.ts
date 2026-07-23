import Phaser from 'phaser';
import { COLORS } from '../config';

export class Brick extends Phaser.Physics.Arcade.Sprite {
  hp = 1;
  brickType: 'hp' | 'indestructible' = 'hp';
  maxHp = 1;
  /** Grid coordinates for explosion neighbor lookups. */
  gridCol = 0;
  gridRow = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'brick');
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static
    this.setOrigin(0.5, 0.5);
  }

  setup(
    kind: 'hp' | 'indestructible',
    hp: number,
    row = 0,
    col = 0,
  ): void {
    this.brickType = kind;
    this.gridCol = col;
    this.gridRow = row;
    this.hp = kind === 'indestructible' ? Number.POSITIVE_INFINITY : hp;
    this.maxHp = kind === 'indestructible' ? 99 : hp;
    this.applyTint();
    // Subtle faux-3D: higher rows slightly smaller / darker depth cue
    const depth = 1 - Math.min(row, 8) * 0.012;
    this.setScale(depth);
    this.setActive(true);
    this.setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = true;
  }

  /** Instant destroy (blast / fireball). Works on HP and concrete X. */
  forceDestroy(): { destroyed: boolean } {
    if (!this.active) return { destroyed: false };
    this.hp = 0;
    this.destroyBrick();
    return { destroyed: true };
  }

  get isIndestructible(): boolean {
    return this.brickType === 'indestructible';
  }

  /** Returns true if brick was destroyed. Fireballs one-shot all damageable bricks. */
  takeHit(isFireball: boolean): { destroyed: boolean; damaged: boolean } {
    if (this.isIndestructible) {
      if (!isFireball) return { destroyed: false, damaged: false };
      this.destroyBrick();
      return { destroyed: true, damaged: true };
    }
    if (isFireball) {
      this.hp = 0;
      this.destroyBrick();
      return { destroyed: true, damaged: true };
    }
    this.hp -= 1;
    if (this.hp <= 0) {
      this.destroyBrick();
      return { destroyed: true, damaged: true };
    }
    this.applyTint();
    return { destroyed: false, damaged: true };
  }

  private destroyBrick(): void {
    this.setActive(false);
    this.setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = false;
  }

  applyTint(): void {
    if (this.isIndestructible) {
      this.setTint(COLORS.brickX);
      return;
    }
    const h = Math.max(1, Math.min(3, Math.ceil(this.hp)));
    if (h >= 3) this.setTint(COLORS.brick3);
    else if (h === 2) this.setTint(COLORS.brick2);
    else this.setTint(COLORS.brick1);
  }

  get tintColor(): number {
    if (this.isIndestructible) return COLORS.brickX;
    const h = Math.max(1, Math.min(3, Math.ceil(this.hp)));
    if (h >= 3) return COLORS.brick3;
    if (h === 2) return COLORS.brick2;
    return COLORS.brick1;
  }
}
