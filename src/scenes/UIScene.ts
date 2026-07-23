import Phaser from 'phaser';
import { COLORS, HEIGHT, HIGH_SCORE_KEY, WIDTH } from '../config';

type OverlayMode = 'none' | 'levelComplete' | 'gameOver' | 'victory';

export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private overlay?: Phaser.GameObjects.Container;

  constructor() {
    super('UIScene');
  }

  create(): void {
    // Separate camera — HUD never shakes with GameScene
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
    };

    this.scoreText = this.add.text(16, 12, 'Score: 0', style);
    this.livesText = this.add
      .text(WIDTH / 2, 12, 'Lives: 3', style)
      .setOrigin(0.5, 0);
    this.levelText = this.add
      .text(WIDTH - 16, 12, 'Level: 1', style)
      .setOrigin(1, 0);

    this.refreshFromRegistry();

    this.registry.events.on('changedata', this.onRegistryChange, this);

    this.events.on('shutdown', () => {
      this.registry.events.off('changedata', this.onRegistryChange, this);
    });

    // Listen for overlay requests from GameScene via registry flags
    this.registry.events.on('changedata-uiOverlay', this.onOverlayFlag, this);
  }

  private onRegistryChange(
    _parent: Phaser.Data.DataManager,
    key: string,
  ): void {
    if (key === 'score' || key === 'lives' || key === 'level') {
      this.refreshFromRegistry();
    }
    if (key === 'score') {
      this.maybeUpdateHighScore();
    }
  }

  private refreshFromRegistry(): void {
    const score = (this.registry.get('score') as number) ?? 0;
    const lives = (this.registry.get('lives') as number) ?? 0;
    const level = ((this.registry.get('level') as number) ?? 0) + 1;
    this.scoreText.setText(`Score: ${score}`);
    this.livesText.setText(`Lives: ${lives}`);
    this.levelText.setText(`Level: ${level}`);
  }

  private maybeUpdateHighScore(): void {
    const score = (this.registry.get('score') as number) ?? 0;
    const high = (this.registry.get('highScore') as number) ?? 0;
    if (score > high) {
      this.registry.set('highScore', score);
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(score));
      } catch {
        // ignore
      }
    }
  }

  /** Phaser `changedata-uiOverlay` passes (parent, value, previousValue). */
  private onOverlayFlag(
    _parent: Phaser.Data.DataManager,
    value: unknown,
  ): void {
    this.showOverlay((value as OverlayMode) ?? 'none');
  }

  showOverlay(mode: OverlayMode): void {
    this.clearOverlay();
    if (mode === 'none') return;

    const container = this.add.container(WIDTH / 2, HEIGHT / 2);
    const bg = this.add
      .rectangle(0, 0, WIDTH * 0.7, 160, 0x000000, 0.75)
      .setStrokeStyle(2, COLORS.title);

    let title = '';
    let sub = 'Press SPACE';
    if (mode === 'levelComplete') {
      title = 'Level Clear!';
      sub = 'Press SPACE for next level';
    } else if (mode === 'gameOver') {
      title = 'Game Over';
      sub = 'Press SPACE to return to menu';
    } else if (mode === 'victory') {
      title = 'Victory!';
      const score = (this.registry.get('score') as number) ?? 0;
      sub = `Final Score: ${score}  —  Press SPACE`;
    }

    const t = this.add
      .text(0, -30, title, {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#4fc3f7',
      })
      .setOrigin(0.5);
    const s = this.add
      .text(0, 30, sub, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    container.add([bg, t, s]);
    this.overlay = container;
  }

  private clearOverlay(): void {
    this.overlay?.destroy(true);
    this.overlay = undefined;
  }
}
