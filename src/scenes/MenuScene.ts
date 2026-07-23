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

    const progress = loadProgress();
    const high = progress.highScore;
    const touch = prefersTouchUi();
    const hasContinue = canContinue(progress);

    this.add
      .text(WIDTH / 2, HEIGHT * 0.2, 'ORC-BALL', {
        fontFamily: 'monospace',
        fontSize: touch ? '48px' : '56px',
        color: '#4fc3f7',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, HEIGHT * 0.32, 'DX-Ball Style Breakout', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#90a4ae',
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, HEIGHT * 0.4, `High Score: ${high}`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffd54f',
      })
      .setOrigin(0.5);

    if (progress.highestLevel > 0) {
      this.add
        .text(
          WIDTH / 2,
          HEIGHT * 0.46,
          `Best level reached: ${progress.highestLevel + 1}`,
          {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#78909c',
          },
        )
        .setOrigin(0.5);
    }

    // Menu buttons
    let y = HEIGHT * 0.54;
    if (hasContinue && progress.run) {
      const run = progress.run;
      this.addMenuButton(
        WIDTH / 2,
        y,
        `Continue  (Lv ${run.level + 1} · ${run.score} pts · ${run.lives}♥)`,
        () => this.startFromRun(run),
        true,
      );
      y += 52;
    }

    this.addMenuButton(
      WIDTH / 2,
      y,
      hasContinue ? 'New Game' : touch ? 'Tap / SPACE — New Game' : 'SPACE — New Game',
      () => this.startNewGame(),
      !hasContinue,
    );
    y += 52;

    this.add
      .text(
        WIDTH / 2,
        HEIGHT * 0.82,
        touch
          ? 'Drag move  ·  ESC pause menu  ·  progress auto-saves'
          : '←→ move  SPACE serve  ESC menu  ·  progress auto-saves',
        {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#546e7a',
        },
      )
      .setOrigin(0.5);

    this.add
      .text(
        WIDTH / 2,
        HEIGHT * 0.88,
        'G=GLUE  B=BULLET  L=LASER  M=MULTI  E/S=size  +=life',
        {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#455a64',
        },
      )
      .setOrigin(0.5);

    this.input.keyboard?.addCapture('SPACE,LEFT,RIGHT,A,D,P,ESC');

    const space = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
    // SPACE: continue if available, else new game
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
      .rectangle(x, y, Math.min(WIDTH - 40, 420), 42, primary ? 0x1565c0 : 0x1a2332, 1)
      .setStrokeStyle(2, primary ? 0x4fc3f7 : 0x546e7a)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: primary ? '16px' : '15px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(primary ? 0x1976d2 : 0x263348, 1);
      text.setColor('#4fc3f7');
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(primary ? 0x1565c0 : 0x1a2332, 1);
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
