import Phaser from 'phaser';
import { COLORS, HEIGHT, START_LIVES, WIDTH } from '../config';
import { levelCount } from '../data/levels';
import {
  LEADERBOARD_TOP_N,
  type RankedEntry,
} from '../logic/leaderboardRules';
import { prefersTouchUi } from '../logic/touch';
import {
  canContinue,
  clearRunKeepUnlocks,
  loadProgress,
  type RunProgress,
} from '../systems/ProgressSave';
import { fetchLeaderboard } from '../systems/LeaderboardClient';
import { DEFERRED_TRACK_ASSETS, Music } from '../systems/Music';
import { Sfx } from '../systems/Sfx';

export class MenuScene extends Phaser.Scene {
  private sfx!: Sfx;
  private deferredAudioReady = false;
  private boardOverlay?: Phaser.GameObjects.Container;
  private boardOpen = false;

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
    this.boardOpen = false;

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

    // Badge if the player has beaten the full campaign at least once
    if (progress.highestLevel >= levelCount() - 1) {
      this.add
        .text(14, HEIGHT - 12, 'CAMPAIGN CLEARED', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffd54f',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0, 1)
        .setDepth(5);
    }

    // Play buttons near the paddle board area
    let y = HEIGHT * 0.68;
    if (hasContinue && progress.run) {
      const run = progress.run;
      this.addMenuButton(
        WIDTH / 2,
        y,
        `Continue  ·  Lv ${run.level + 1}`,
        () => this.startFromRun(run),
        true,
      );
      y += 46;
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
    y += 46;
    this.addMenuButton(
      WIDTH / 2,
      y,
      'Leaderboard',
      () => {
        void this.openLeaderboard();
      },
      false,
    );

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
    space?.on('down', () => {
      if (this.boardOpen) {
        this.closeLeaderboard();
        return;
      }
      if (hasContinue && progress.run) this.startFromRun(progress.run);
      else this.startNewGame();
    });

    const esc = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    esc?.on('down', () => {
      if (this.boardOpen) this.closeLeaderboard();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.closeLeaderboard();
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
    bg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      onClick();
    });
  }

  private async openLeaderboard(): Promise<void> {
    if (this.boardOpen) return;
    this.boardOpen = true;

    const container = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(200);
    const veil = this.add
      .rectangle(0, 0, WIDTH, HEIGHT, 0x050510, 0.88)
      .setInteractive();
    // Swallow clicks on the panel so they don't start a game
    veil.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
      this.closeLeaderboard();
    });

    const panelW = Math.min(WIDTH * 0.92, 560);
    const panelH = Math.min(HEIGHT * 0.9, 520);
    const panel = this.add
      .rectangle(0, 0, panelW, panelH, 0x0a1220, 0.97)
      .setStrokeStyle(3, 0x4fc3f7, 1)
      .setInteractive();
    panel.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
    });

    const title = this.add
      .text(0, -panelH / 2 + 36, 'TOP MASTERS', {
        fontFamily: 'monospace',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#4fc3f7',
        stroke: '#001018',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const status = this.add
      .text(0, -panelH / 2 + 68, 'Loading…', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffd54f',
      })
      .setOrigin(0.5);

    const header = this.add
      .text(0, -panelH / 2 + 100, ' #   NAME            SCORE', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#78909c',
      })
      .setOrigin(0.5, 0);

    const body = this.add
      .text(0, -panelH / 2 + 124, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        align: 'left',
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);

    const hint = this.add
      .text(0, panelH / 2 - 28, 'Press SPACE / TAP  ·  close', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#90a4ae',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: hint,
      alpha: { from: 0.45, to: 1 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    container.add([veil, panel, title, status, header, body, hint]);
    this.boardOverlay = container;

    const { entries, error } = await fetchLeaderboard();
    if (!this.boardOpen || !this.boardOverlay) return;

    status.setText(
      error
        ? error
        : entries.length === 0
          ? `No scores yet — clear all ${levelCount()} levels!`
          : `Top ${LEADERBOARD_TOP_N} campaign clears`,
    );
    body.setText(this.formatBoardLines(entries));
  }

  private formatBoardLines(entries: RankedEntry[]): string {
    if (entries.length === 0) return '   — empty —';
    return entries
      .map((e) => {
        const rank = String(e.rank).padStart(2, ' ');
        const name = e.name.slice(0, 12).padEnd(12, ' ');
        const score = String(e.score).padStart(8, ' ');
        return `${rank}   ${name}  ${score}`;
      })
      .join('\n');
  }

  private closeLeaderboard(): void {
    this.boardOverlay?.destroy(true);
    this.boardOverlay = undefined;
    this.boardOpen = false;
  }

  private startNewGame(): void {
    if (this.boardOpen) return;
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
    if (this.boardOpen) return;
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
