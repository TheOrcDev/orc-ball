import Phaser from 'phaser';
import { COLORS, HEIGHT, START_LIVES, WIDTH } from '../config';
import { prefersTouchUi } from '../logic/touch';
import {
  canContinue,
  clearRunKeepUnlocks,
  loadProgress,
  type RunProgress,
} from '../systems/ProgressSave';
import { DEFERRED_TRACK_ASSETS, Music } from '../systems/Music';
import { Sfx } from '../systems/Sfx';

export class MenuScene extends Phaser.Scene {
  private sfx!: Sfx;
  private deferredAudioReady = false;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.sfx = new Sfx(this);
    this.sfx.tryUnlock();
    // Start title music immediately (menu tracks are preloaded in Boot).
    Music.playMenu(this);
    // Kick browser autoplay unlock as soon as anything is pressed.
    Music.armAutoplay(this);
    this.loadDeferredAudio();

    // Full-screen retro landing art
    if (this.textures.exists('menu-bg')) {
      const bg = this.add.image(WIDTH / 2, HEIGHT / 2, 'menu-bg');
      const scale = Math.max(WIDTH / bg.width, HEIGHT / bg.height);
      bg.setScale(scale).setDepth(0);
      // Any click on the art also unlocks audio (not only the buttons).
      bg.setInteractive();
      bg.on('pointerdown', () => {
        this.sfx.tryUnlock();
        Music.tryResumeContext(this);
        Music.ensureAudible(this);
      });
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

    // Any key / pointer on the menu unlocks WebAudio and starts music if blocked.
    this.input.on('pointerdown', () => {
      this.sfx.tryUnlock();
      Music.tryResumeContext(this);
      Music.ensureAudible(this);
    });
    this.input.keyboard?.on('keydown', () => {
      this.sfx.tryUnlock();
      Music.tryResumeContext(this);
      Music.ensureAudible(this);
    });

    const space = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
    space?.once('down', () => {
      if (hasContinue && progress.run) this.startFromRun(progress.run);
      else this.startNewGame();
    });
  }

  /** Gameplay / cue tracks after the menu is already playing. */
  private loadDeferredAudio(): void {
    let queued = 0;
    for (const [key, path] of DEFERRED_TRACK_ASSETS) {
      if (!this.cache.audio.exists(key)) {
        this.load.audio(key, path);
        queued += 1;
      }
    }
    if (queued === 0) {
      this.deferredAudioReady = true;
      return;
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.deferredAudioReady = true;
    });
    this.load.start();
  }

  private whenAudioReady(then: () => void): void {
    if (this.deferredAudioReady) {
      then();
      return;
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.deferredAudioReady = true;
      then();
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
    Music.tryResumeContext(this);
    this.whenAudioReady(() => {
      Music.stop(this);
      clearRunKeepUnlocks();
      const progress = loadProgress();
      this.registry.set('score', 0);
      this.registry.set('lives', START_LIVES);
      this.registry.set('level', 0);
      this.registry.set('highScore', progress.highScore);
      this.scene.start('GameScene', { level: 0 });
    });
  }

  private startFromRun(run: RunProgress): void {
    this.sfx.tryUnlock();
    Music.tryResumeContext(this);
    this.whenAudioReady(() => {
      Music.stop(this);
      const progress = loadProgress();
      this.registry.set('score', run.score);
      this.registry.set('lives', run.lives);
      this.registry.set('level', run.level);
      this.registry.set('highScore', progress.highScore);
      this.scene.start('GameScene', { level: run.level });
    });
  }
}
