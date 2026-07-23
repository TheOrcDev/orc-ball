import Phaser from 'phaser';
import { COLORS, HEIGHT, START_LIVES, WIDTH } from '../config';
import { prefersTouchUi } from '../logic/touch';
import {
  canContinue,
  clearRunKeepUnlocks,
  loadProgress,
  type RunProgress,
} from '../systems/ProgressSave';
import { Music } from '../systems/Music';
import { Sfx } from '../systems/Sfx';

export class MenuScene extends Phaser.Scene {
  private sfx!: Sfx;
  private musicToggleLabel?: Phaser.GameObjects.Text;
  private volumeLabel?: Phaser.GameObjects.Text;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.sfx = new Sfx(this);

    // Full-screen retro landing art
    if (this.textures.exists('menu-bg')) {
      const bg = this.add.image(WIDTH / 2, HEIGHT / 2, 'menu-bg');
      const scale = Math.max(WIDTH / bg.width, HEIGHT / bg.height);
      bg.setScale(scale).setDepth(0);
    }

    const progress = loadProgress();
    const high = progress.highScore;
    const touch = prefersTouchUi();
    const hasContinue = canContinue(progress);

    // Live high score — bottom-right
    this.add
      .text(WIDTH - 14, HEIGHT - 12, `HIGH SCORE ${high}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(1, 1)
      .setDepth(5);

    // Music controls — top-left (out of the main art focal area)
    this.createMusicControls(16, 16);

    // Play buttons near the paddle board area
    let y = HEIGHT * 0.72;
    if (hasContinue && progress.run) {
      const run = progress.run;
      this.addMenuButton(
        WIDTH / 2,
        y,
        `Continue  ·  Lv ${run.level + 1}`,
        () => this.startFromRun(run),
        true,
      );
      y += 48;
      this.addMenuButton(
        WIDTH / 2,
        y,
        'New Game',
        () => this.startNewGame(),
        false,
      );
    } else {
      this.addMenuButton(
        WIDTH / 2,
        y,
        touch ? 'New Game' : 'New Game',
        () => this.startNewGame(),
        true,
      );
    }

    this.input.keyboard?.addCapture('SPACE,LEFT,RIGHT,A,D,P,ESC');

    const space = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
    space?.once('down', () => {
      if (hasContinue && progress.run) this.startFromRun(progress.run);
      else this.startNewGame();
    });
  }

  /** Music ON/OFF + volume percentage (− / +). */
  private createMusicControls(x: number, y: number): void {
    const panel = this.add
      .rectangle(x, y, 200, 78, 0x0a0a12, 0.72)
      .setOrigin(0, 0)
      .setStrokeStyle(1, COLORS.title, 0.5)
      .setDepth(4)
      .setInteractive(); // capture clicks so SPACE logic isn't affected oddly

    const title = this.add
      .text(x + 10, y + 8, 'MUSIC', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#4fc3f7',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(5);

    // ON / OFF toggle
    this.musicToggleLabel = this.add
      .text(x + 10, y + 28, this.musicOnLabel(), {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(5)
      .setInteractive({ useHandCursor: true });

    this.musicToggleLabel.on('pointerdown', () => {
      this.sfx.tryUnlock();
      Music.toggleEnabled(this);
      this.musicToggleLabel?.setText(this.musicOnLabel());
      this.sfx.paddleHit();
    });
    this.musicToggleLabel.on('pointerover', () =>
      this.musicToggleLabel?.setColor('#4fc3f7'),
    );
    this.musicToggleLabel.on('pointerout', () =>
      this.musicToggleLabel?.setColor('#ffffff'),
    );

    // Volume row:  −  50%  +
    const volY = y + 52;
    const minus = this.add
      .text(x + 10, volY, '−', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(5)
      .setInteractive({ useHandCursor: true });

    this.volumeLabel = this.add
      .text(x + 70, volY, this.volumeText(), {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffd54f',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0)
      .setDepth(5);

    const plus = this.add
      .text(x + 130, volY, '+', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(5)
      .setInteractive({ useHandCursor: true });

    const bump = (delta: number) => {
      this.sfx.tryUnlock();
      Music.adjustVolume(delta, this);
      this.volumeLabel?.setText(this.volumeText());
      // If they turn volume up while "off", keep enabled state as-is
      this.sfx.paddleHit();
    };

    minus.on('pointerdown', () => bump(-10));
    plus.on('pointerdown', () => bump(10));
    minus.on('pointerover', () => minus.setColor('#4fc3f7'));
    minus.on('pointerout', () => minus.setColor('#ffffff'));
    plus.on('pointerover', () => plus.setColor('#4fc3f7'));
    plus.on('pointerout', () => plus.setColor('#ffffff'));

    // Keep panel reference live for lint (used as click shield)
    void panel;
    void title;
  }

  private musicOnLabel(): string {
    return Music.isEnabled ? 'Music: ON' : 'Music: OFF';
  }

  private volumeText(): string {
    return `Vol ${Music.volumePercent}%`;
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
        Math.min(WIDTH - 80, 280),
        40,
        primary ? 0x1565c0 : 0x0d1520,
        0.88,
      )
      .setStrokeStyle(2, primary ? 0x4fc3f7 : 0x4fc3f7, primary ? 0.95 : 0.45)
      .setInteractive({ useHandCursor: true })
      .setDepth(4);
    const text = this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(5);

    bg.on('pointerover', () => {
      bg.setFillStyle(primary ? 0x1976d2 : 0x1a2838, 0.95);
      text.setColor('#4fc3f7');
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(primary ? 0x1565c0 : 0x0d1520, 0.88);
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
