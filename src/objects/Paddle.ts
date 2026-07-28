import Phaser from 'phaser';
import {
  PADDLE_HEIGHT,
  PADDLE_SCALE_NORMAL,
  PADDLE_SPEED,
  PADDLE_Y,
  WIDTH,
} from '../config';
import {
  advanceFxRedrawClock,
  isFxRedrawDue,
} from '../logic/fxCadence';
import { paddleBodySetSizeArgs } from '../logic/paddleBody';
import { clampPaddleX } from '../logic/touch';

const OVERLAY_REDRAW_INTERVAL_MS = 50;

export class Paddle extends Phaser.Physics.Arcade.Sprite {
  sticky = false;
  /** Locked vertical position (higher on touch so finger zone sits below). */
  private lockedY: number;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private moveSpeed = PADDLE_SPEED;
  /** When set, paddle tracks this world X (touch/mouse drag). */
  private pointerTargetX: number | null = null;
  /** Smoothed horizontal velocity for ball english when pointer-steering. */
  private pointerVelX = 0;
  private glueLook = false;
  /** Twin laser cannons while LASER power is active. */
  private laserOverlay?: Phaser.GameObjects.Graphics;
  private laserLook = false;
  private laserPulse = 0;
  private laserRedrawElapsedMs = 0;
  private widthScale = PADDLE_SCALE_NORMAL;

  constructor(scene: Phaser.Scene, x?: number, y?: number) {
    const startY = y ?? PADDLE_Y;
    super(scene, x ?? WIDTH / 2, startY, 'paddle');
    this.lockedY = startY;
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

    // Allocate the laser layer during setup, outside pickup/physics callbacks.
    this.laserOverlay = scene.add
      .graphics()
      .setDepth(this.depth + 2)
      .setVisible(false);
  }

  /**
   * Phaser Arcade Body.setSize stores unscaled source size then multiplies by
   * scaleX/Y — pass frame width/height (this.width/height), NOT displayWidth.
   * For glue texture (taller frame with drips), body height stays paddle face only.
   */
  syncBodySize(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.glueLook) {
      // Texture is taller (body + drips); physics uses face size only
      const { width } = paddleBodySetSizeArgs(this.width, PADDLE_HEIGHT);
      body.setSize(width, PADDLE_HEIGHT, false);
      // Center body on the paddle face (upper part of tall texture)
      const frameH = this.height;
      body.setOffset(0, (frameH - PADDLE_HEIGHT) / 2 - 2);
    } else {
      const { width, height } = paddleBodySetSizeArgs(this.width, this.height);
      body.setSize(width, height, true);
    }
  }

  setWidthScale(scale: number): void {
    if (
      this.widthScale === scale &&
      this.scaleX === scale &&
      this.scaleY === scale
    ) {
      return;
    }
    this.widthScale = scale;
    this.setScale(scale);
    this.syncBodySize();
    if (this.laserLook) {
      this.syncOverlayState(this.laserOverlay, 2);
      this.redrawLaserOverlay();
      this.laserRedrawElapsedMs = 0;
    }
  }

  resetWidth(): void {
    this.setWidthScale(PADDLE_SCALE_NORMAL);
  }

  /**
   * GLUE power: swap to a pre-baked slime paddle texture.
   * This is the player object looking "glued", not the arena.
   */
  setGlueLook(active: boolean): void {
    if (this.glueLook === active && this.sticky === active) return;

    this.glueLook = active;
    this.sticky = active;
    if (active) {
      this.setTexture('paddle-glue');
      this.clearTint();
      // Origin: center of the solid face (not including drip hang)
      // Texture height = PADDLE_HEIGHT + 18; face center is slightly above mid
      this.setOrigin(0.5, PADDLE_HEIGHT / 2 / (PADDLE_HEIGHT + 18));
      this.setScale(this.widthScale);
      this.syncBodySize();
      // The texture carries the full slime/drip treatment without per-frame
      // vector tessellation.
    } else {
      this.setTexture('paddle');
      this.setOrigin(0.5, 0.5);
      this.setScale(this.widthScale);
      this.syncBodySize();
    }
  }

  /**
   * LASER power: draw twin gun turrets on the left/right ends of the paddle.
   */
  setLaserLook(active: boolean): void {
    if (this.laserLook === active) return;

    this.laserLook = active;
    if (active) {
      this.ensureLaserOverlay();
      this.laserOverlay?.setVisible(true);
      this.syncOverlayState(this.laserOverlay, 2);
      this.redrawLaserOverlay();
      this.laserRedrawElapsedMs = 0;
    } else {
      this.laserOverlay?.setVisible(false);
    }
  }

  get hasLaserLook(): boolean {
    return this.laserLook;
  }

  private ensureLaserOverlay(): void {
    if (!this.laserOverlay) {
      this.laserOverlay = this.scene.add
        .graphics()
        .setDepth(this.depth + 2)
        .setVisible(false);
    }
  }

  private destroyLaserOverlay(): void {
    this.laserOverlay?.destroy();
    this.laserOverlay = undefined;
  }

  private redrawLaserOverlay(): void {
    const g = this.laserOverlay;
    if (!g || !this.laserLook) return;
    g.clear();

    const halfW = this.displayWidth / 2;
    const top = -this.faceHeight / 2;
    const faceH = this.faceHeight;
    const inset = 8 * this.scaleX;
    const leftX = -halfW + inset;
    const rightX = halfW - inset;
    const glow = 0.55 + Math.sin(this.laserPulse * 4) * 0.2;

    this.drawLaserCannon(g, leftX, top, faceH, glow);
    this.drawLaserCannon(g, rightX, top, faceH, glow);
  }

  private drawLaserCannon(
    g: Phaser.GameObjects.Graphics,
    x: number,
    faceTop: number,
    faceH: number,
    glow: number,
  ): void {
    const s = this.scaleX;
    const baseY = faceTop + faceH * 0.15;
    // Mount plate on paddle
    g.fillStyle(0x37474f, 0.95);
    g.fillRoundedRect(x - 7 * s, baseY, 14 * s, faceH * 0.7, 2);
    // Barrel pointing up
    g.fillStyle(0xff1744, 0.95);
    g.fillRect(x - 3 * s, faceTop - 14 * s, 6 * s, 16 * s);
    g.fillStyle(0xff8a80, glow);
    g.fillRect(x - 1.5 * s, faceTop - 14 * s, 3 * s, 16 * s);
    // Muzzle tip glow
    g.fillStyle(0xffffff, glow);
    g.fillCircle(x, faceTop - 14 * s, 3.5 * s);
    g.fillStyle(0xff5252, 0.8);
    g.fillCircle(x, faceTop - 14 * s, 2 * s);
  }

  /**
   * Overlay geometry is paddle-local. Moving the Graphics object is cheap and
   * keeps it attached every frame without clearing/rebuilding its command list.
   */
  private syncOverlayState(
    overlay: Phaser.GameObjects.Graphics | undefined,
    depthOffset: number,
  ): void {
    if (!overlay) return;
    if (overlay.x !== this.x || overlay.y !== this.y) {
      overlay.setPosition(this.x, this.y);
    }
    if (overlay.alpha !== this.alpha) {
      overlay.setAlpha(this.alpha);
    }
    const targetDepth = this.depth + depthOffset;
    if (overlay.depth !== targetDepth) {
      overlay.setDepth(targetDepth);
    }
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

    if (this.x < half) {
      this.x = half;
      body.setVelocityX(Math.max(0, body.velocity.x));
      this.pointerVelX = body.velocity.x;
    } else if (this.x > WIDTH - half) {
      this.x = WIDTH - half;
      body.setVelocityX(Math.min(0, body.velocity.x));
      this.pointerVelX = body.velocity.x;
    }

    this.y = this.lockedY;
    body.setVelocityY(0);

    if (this.laserLook) {
      this.laserPulse += dt;
      this.syncOverlayState(this.laserOverlay, 2);
      this.laserRedrawElapsedMs = advanceFxRedrawClock(
        this.laserRedrawElapsedMs,
        delta,
        OVERLAY_REDRAW_INTERVAL_MS,
      );
      if (
        isFxRedrawDue(
          this.laserRedrawElapsedMs,
          OVERLAY_REDRAW_INTERVAL_MS,
        )
      ) {
        this.redrawLaserOverlay();
        this.laserRedrawElapsedMs = 0;
      }
    }
  }

  get boundsLeft(): number {
    return this.displayWidth / 2;
  }

  get boundsRight(): number {
    return WIDTH - this.displayWidth / 2;
  }

  get paddleY(): number {
    return this.lockedY;
  }

  /** Solid face height (excludes hanging drips on glue texture). */
  get faceHeight(): number {
    return PADDLE_HEIGHT * this.scaleY;
  }

  /** Top of the solid paddle face — use for ball stick / hits. */
  get faceTop(): number {
    return this.y - this.faceHeight / 2;
  }

  destroy(fromScene?: boolean): void {
    this.destroyLaserOverlay();
    super.destroy(fromScene);
  }
}
