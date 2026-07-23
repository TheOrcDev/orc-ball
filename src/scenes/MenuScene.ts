import Phaser from 'phaser';
import { COLORS, HEIGHT, START_LIVES, WIDTH } from '../config';
import { prefersTouchUi } from '../logic/touch';
import {
  canContinue,
  clearRunKeepUnlocks,
  loadProgress,
  type RunProgress,
} from '../systems/ProgressSave';
import { Sfx } from '../systems/Sfx';

export class MenuScene extends Phaser.Scene {
  private sfx!: Sfx;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.sfx = new Sfx(this);

    // Full-screen retro landing art
    if (this.textures.exists('menu-bg')) {
      const bg = this.add.image(WIDTH / 2, HEIGHT / 2, 'menu-bg');
      // Cover 800×600 playfield (image is 1280×720)
      const scale = Math.max(WIDTH / bg.width, HEIGHT / bg.height);
      bg.setScale(scale).setDepth(0);
    }

    // Bottom scrim so buttons stay readable over the art
    this.add
      .rectangle(WIDTH / 2, HEIGHT * 0.78, WIDTH, HEIGHT * 0.48, 0x000000, 0.62)
      .setDepth(1);

    const progress = loadProgress();
    const high = progress.highScore;
    const touch = prefersTouchUi();
    const hasContinue = canContinue(progress);

    // Title is already in the art — small tagline only
    this.add
      .text(WIDTH / 2, HEIGHT * 0.52, 'DX-Ball Style Breakout', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#b0bec5',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(WIDTH / 2, HEIGHT * 0.575, `High Score: ${high}`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffd54f',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(2);

    if (progress.highestLevel > 0) {
      this.add
        .text(
          WIDTH / 2,
          HEIGHT * 0.62,
          `Best level reached: ${progress.highestLevel + 1}`,
          {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#90a4ae',
            stroke: '#000000',
            strokeThickness: 3,
          },
        )
        .setOrigin(0.5)
        .setDepth(2);
    }

    // Menu buttons lower on the art
    let y = HEIGHT * 0.69;
    if (hasContinue && progress.run) {
      const run = progress.run;
      this.addMenuButton(
        WIDTH / 2,
        y,
        `Continue  (Lv ${run.level + 1} · ${run.score} pts · ${run.lives}♥)`,
        () => this.startFromRun(run),
        true,
      );
      y += 50;
    }

    this.addMenuButton(
      WIDTH / 2,
      y,
      hasContinue
        ? 'New Game'
        : touch
          ? 'Tap / SPACE — New Game'
          : 'SPACE — New Game',
      () => this.startNewGame(),
      !hasContinue,
    );

    this.add
      .text(
        WIDTH / 2,
        HEIGHT * 0.93,
        touch
          ? 'Drag move  ·  ESC pause  ·  progress saves'
          : '←→ move  SPACE serve  ESC menu  ·  progress saves',
        {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#78909c',
          stroke: '#000000',
          strokeThickness: 2,
        },
      )
      .setOrigin(0.5)
      .setDepth(2);

    this.input.keyboard?.addCapture('SPACE,LEFT,RIGHT,A,D,P,ESC');

    const space = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
    space?.once('down', () => {
      if (hasContinue && progress.run) this.startFromRun(progress.run);
      else this.startNewGame();
    });
  }

  private addMenuButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    primary: boolean,
  ): void {
    const bg = this.add
      .rectangle(
        x,
        y,
        Math.min(WIDTH - 40, 420),
        42,
        primary ? 0x1565c0 : 0x1a2332,
        0.92,
      )
      .setStrokeStyle(2, primary ? 0x4fc3f7 : 0x546e7a)
      .setInteractive({ useHandCursor: true })
      .setDepth(2);
    const text = this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: primary ? '16px' : '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(3);

    bg.on('pointerover', () => {
      bg.setFillStyle(primary ? 0x1976d2 : 0x263348, 0.95);
      text.setColor('#4fc3f7');
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(primary ? 0x1565c0 : 0x1a2332, 0.92);
      text.setColor('#ffffff');
    });
    bg.on('pointerdown', () => {
      onClick();
    });
  }

  private startNewGame(): void {
    this.sfx.tryUnlock();
    clearRunKeepUnlocks();
    const progress = loadProgress();
    this.registry.set('score', 0);
    this.registry.set('lives', START_LIVES);
    this.registry.set('level', 0);
    this.registry.set('highScore', progress.highScore);
    this.scene.start('GameScene', { level: 0 });
  }

  private startFromRun(run: RunProgress): void {
    this.sfx.tryUnlock();
    const progress = loadProgress();
    this.registry.set('score', run.score);
    this.registry.set('lives', run.lives);
    this.registry.set('level', run.level);
    this.registry.set('highScore', progress.highScore);
    this.scene.start('GameScene', { level: run.level });
  }
}
