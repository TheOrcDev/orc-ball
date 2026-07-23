import Phaser from 'phaser';
import { COLORS, HEIGHT, WIDTH } from '../config';
import { levelCount } from '../data/levels';
import { updateHighScore } from '../systems/ProgressSave';

export type OverlayMode = 'none' | 'levelComplete' | 'gameOver' | 'victory';

export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private effectsText!: Phaser.GameObjects.Text;
  private overlay?: Phaser.GameObjects.Container;
  private confetti?: Phaser.GameObjects.Particles.ParticleEmitter;

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

    this.scoreText = this.add.text(16, 12, 'Score: 0', style).setDepth(10);
    this.livesText = this.add
      .text(WIDTH / 2, 12, 'Lives: 3', style)
      .setOrigin(0.5, 0)
      .setDepth(10);
    this.levelText = this.add
      .text(WIDTH - 16, 12, 'Level: 1', style)
      .setOrigin(1, 0)
      .setDepth(10);

    this.effectsText = this.add
      .text(WIDTH / 2, 36, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffd54f',
      })
      .setOrigin(0.5, 0)
      .setDepth(10);

    this.refreshFromRegistry();
    this.refreshEffects();

    this.registry.events.on('changedata', this.onRegistryChange, this);

    this.events.on('shutdown', () => {
      this.registry.events.off('changedata', this.onRegistryChange, this);
      this.clearOverlay();
    });

    // Show any overlay already requested before UIScene finished launching
    const pending = this.registry.get('uiOverlay') as OverlayMode | undefined;
    if (pending && pending !== 'none') {
      this.showOverlay(pending);
    }
  }

  private onRegistryChange(
    _parent: Phaser.Data.DataManager,
    key: string,
    value: unknown,
  ): void {
    if (key === 'score' || key === 'lives' || key === 'level') {
      this.refreshFromRegistry();
    }
    if (key === 'score') {
      this.maybeUpdateHighScore();
    }
    if (
      key === 'effectGlue' ||
      key === 'effectBullet' ||
      key === 'effectLaser' ||
      key === 'effectSlow' ||
      key === 'effectExplode'
    ) {
      this.refreshEffects();
    }
    if (key === 'uiOverlay') {
      this.showOverlay((value as OverlayMode) ?? 'none');
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

  private refreshEffects(): void {
    const glue = Boolean(this.registry.get('effectGlue'));
    const bullet = Boolean(this.registry.get('effectBullet'));
    const laser = Boolean(this.registry.get('effectLaser'));
    const slow = Boolean(this.registry.get('effectSlow'));
    const explode = Boolean(this.registry.get('effectExplode'));
    const parts: string[] = [];
    if (glue) parts.push('GLUE (launch to free)');
    if (bullet) parts.push('BULLET');
    if (laser) parts.push('LASER (SPACE)');
    if (slow) parts.push('SLOW');
    if (explode) parts.push('BLAST');
    this.effectsText.setText(parts.join('  ·  '));
    if (explode) this.effectsText.setColor('#ffc107');
    else if (laser) this.effectsText.setColor('#ff5252');
    else if (glue && bullet) this.effectsText.setColor('#ffab40');
    else if (glue) this.effectsText.setColor('#26a69a');
    else if (bullet) this.effectsText.setColor('#ff7043');
    else if (slow) this.effectsText.setColor('#29b6f6');
    else this.effectsText.setColor('#ffd54f');
  }

  private maybeUpdateHighScore(): void {
    const score = (this.registry.get('score') as number) ?? 0;
    const high = (this.registry.get('highScore') as number) ?? 0;
    if (score > high) {
      const p = updateHighScore(score);
      this.registry.set('highScore', p.highScore);
    }
  }

  showOverlay(mode: OverlayMode): void {
    this.clearOverlay();
    if (mode === 'none') return;

    if (mode === 'victory') {
      this.buildVictoryOverlay();
      return;
    }
    if (mode === 'gameOver') {
      this.buildSimpleOverlay({
        title: 'Game Over',
        titleColor: '#ef5350',
        lines: this.gameOverLines(),
        hint: 'Press SPACE / TAP  ·  return to menu',
        panelH: 220,
      });
      return;
    }
    // levelComplete
    this.buildSimpleOverlay({
      title: 'Level Clear!',
      titleColor: '#4fc3f7',
      lines: this.levelClearLines(),
      hint: 'Press SPACE / TAP  ·  next level',
      panelH: 180,
    });
  }

  private levelClearLines(): string[] {
    const score = (this.registry.get('score') as number) ?? 0;
    const level = ((this.registry.get('level') as number) ?? 0) + 1;
    return [`Level ${level} secured`, `Score  ${score}`];
  }

  private gameOverLines(): string[] {
    const score = (this.registry.get('score') as number) ?? 0;
    const high = (this.registry.get('highScore') as number) ?? 0;
    const level = ((this.registry.get('level') as number) ?? 0) + 1;
    const lines = [
      `Reached level  ${level} / ${levelCount()}`,
      `Score         ${score}`,
      `High score    ${high}`,
    ];
    if (score >= high && score > 0) {
      lines.push('New high score!');
    }
    return lines;
  }

  private buildVictoryOverlay(): void {
    const score = (this.registry.get('score') as number) ?? 0;
    const high = (this.registry.get('highScore') as number) ?? 0;
    const lives = (this.registry.get('lives') as number) ?? 0;
    const clearBonus = (this.registry.get('victoryClearBonus') as number) ?? 0;
    const lifeBonus = (this.registry.get('victoryLifeBonus') as number) ?? 0;
    const isNewHigh = score >= high && score > 0;

    const container = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(1000);

    // Full dim so the board doesn't distract (not interactive — GameScene
    // handles SPACE / tap to dismiss while pausedForOverlay).
    const veil = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x050510, 0.82);

    const panelW = Math.min(WIDTH * 0.86, 520);
    const panelH = 340;
    const panel = this.add
      .rectangle(0, 0, panelW, panelH, 0x0a1220, 0.96)
      .setStrokeStyle(3, 0x4fc3f7, 1);

    const glow = this.add
      .rectangle(0, 0, panelW + 10, panelH + 10, 0x4fc3f7, 0.12)
      .setStrokeStyle(1, 0x4fc3f7, 0.35);

    const title = this.add
      .text(0, -128, 'CONGRATULATIONS!', {
        fontFamily: 'monospace',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#4fc3f7',
        stroke: '#001018',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(0, -88, `All ${levelCount()} levels cleared`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#a5d6a7',
      })
      .setOrigin(0.5);

    const orc = this.add
      .text(0, -52, 'ORC-BALL MASTER', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffd54f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const statLines = [
      `Final score     ${score}`,
      clearBonus > 0 ? `Clear bonus    +${clearBonus}` : null,
      lifeBonus > 0 ? `Lives bonus    +${lifeBonus}  (${lives} left)` : null,
      `High score      ${high}`,
    ].filter((x): x is string => Boolean(x));

    const stats = this.add
      .text(0, 10, statLines.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        align: 'left',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    const nodes: Phaser.GameObjects.GameObject[] = [
      veil,
      glow,
      panel,
      title,
      subtitle,
      orc,
      stats,
    ];

    if (isNewHigh) {
      const banner = this.add
        .text(0, 78, '★  NEW HIGH SCORE  ★', {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#ffeb3b',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      nodes.push(banner);
      this.tweens.add({
        targets: banner,
        scale: { from: 0.92, to: 1.06 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    }

    const hint = this.add
      .text(0, 128, 'Press SPACE / TAP  ·  return to menu', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#90a4ae',
      })
      .setOrigin(0.5);
    nodes.push(hint);

    this.tweens.add({
      targets: hint,
      alpha: { from: 0.45, to: 1 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.tweens.add({
      targets: title,
      scale: { from: 0.6, to: 1 },
      alpha: { from: 0, to: 1 },
      duration: 420,
      ease: 'Back.easeOut',
    });

    container.add(nodes);
    this.overlay = container;
    this.spawnConfetti();
  }

  private buildSimpleOverlay(opts: {
    title: string;
    titleColor: string;
    lines: string[];
    hint: string;
    panelH: number;
  }): void {
    const container = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(1000);
    const veil = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x050510, 0.65);
    const panelW = Math.min(WIDTH * 0.78, 440);
    const panel = this.add
      .rectangle(0, 0, panelW, opts.panelH, 0x0a1220, 0.94)
      .setStrokeStyle(2, COLORS.title);

    const title = this.add
      .text(0, -opts.panelH / 2 + 40, opts.title, {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: opts.titleColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const body = this.add
      .text(0, 8, opts.lines.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(0, opts.panelH / 2 - 32, opts.hint, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#90a4ae',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: hint,
      alpha: { from: 0.5, to: 1 },
      duration: 650,
      yoyo: true,
      repeat: -1,
    });

    container.add([veil, panel, title, body, hint]);
    this.overlay = container;
  }

  private spawnConfetti(): void {
    if (!this.textures.exists('particle')) return;
    this.confetti?.destroy();
    this.confetti = this.add.particles(WIDTH / 2, -10, 'particle', {
      x: { min: -WIDTH / 2, max: WIDTH / 2 },
      speedY: { min: 80, max: 220 },
      speedX: { min: -60, max: 60 },
      lifespan: 2200,
      scale: { start: 1.2, end: 0.2 },
      quantity: 3,
      frequency: 40,
      tint: [0x4fc3f7, 0x66bb6a, 0xffa726, 0xef5350, 0xffd54f, 0xab47bc],
      blendMode: 'ADD',
      emitting: true,
    });
    this.confetti.setDepth(999);
    // Stop raining after a few seconds
    this.time.delayedCall(3500, () => {
      this.confetti?.stop();
    });
  }

  private clearOverlay(): void {
    this.overlay?.destroy(true);
    this.overlay = undefined;
    this.confetti?.destroy();
    this.confetti = undefined;
  }
}
