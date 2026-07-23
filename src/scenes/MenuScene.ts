import Phaser from 'phaser';
import { COLORS, HEIGHT, HIGH_SCORE_KEY, START_LIVES, WIDTH } from '../config';
import { prefersTouchUi } from '../logic/touch';
import { Sfx } from '../systems/Sfx';

export class MenuScene extends Phaser.Scene {
  private sfx!: Sfx;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.sfx = new Sfx(this);

    const high = this.loadHighScore();
    const touch = prefersTouchUi();

    this.add
      .text(WIDTH / 2, HEIGHT * 0.28, 'ORC-BALL', {
        fontFamily: 'monospace',
        fontSize: touch ? '48px' : '56px',
        color: '#4fc3f7',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, HEIGHT * 0.4, 'DX-Ball Style Breakout', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#90a4ae',
      })
      .setOrigin(0.5);

    this.add
      .text(
        WIDTH / 2,
        HEIGHT * 0.55,
        touch ? 'Tap to Start' : 'Press SPACE to Start',
        {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#ffffff',
        },
      )
      .setOrigin(0.5);

    this.add
      .text(
        WIDTH / 2,
        HEIGHT * 0.62,
        touch
          ? 'Drag to move paddle  ·  Tap / LAUNCH to serve  ·  P pause'
          : '← → / A D  move    SPACE  serve    P  pause',
        {
          fontFamily: 'monospace',
          fontSize: touch ? '13px' : '14px',
          color: '#78909c',
        },
      )
      .setOrigin(0.5);

    this.add
      .text(
        WIDTH / 2,
        HEIGHT * 0.69,
        touch
          ? 'G=GLUE  B=BULLET  R=LASER (twin beams)'
          : 'G=GLUE  B=BULLET  R=LASER (SPACE shoots twin beams)',
        {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#546e7a',
        },
      )
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, HEIGHT * 0.78, `High Score: ${high}`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffd54f',
      })
      .setOrigin(0.5);

    // Capture keys so SPACE/arrows/P don't scroll the page
    this.input.keyboard?.addCapture('SPACE,LEFT,RIGHT,A,D,P');

    const space = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
    space?.once('down', () => this.startGame());

    // Click/tap unlocks audio and starts (required on mobile)
    this.input.once('pointerdown', () => this.startGame());
  }

  private startGame(): void {
    this.sfx.tryUnlock();
    // Fresh game
    this.registry.set('score', 0);
    this.registry.set('lives', START_LIVES);
    this.registry.set('level', 0);
    this.registry.set('highScore', this.loadHighScore());
    this.scene.start('GameScene', { level: 0 });
  }

  private loadHighScore(): number {
    try {
      const raw = localStorage.getItem(HIGH_SCORE_KEY);
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }
}
