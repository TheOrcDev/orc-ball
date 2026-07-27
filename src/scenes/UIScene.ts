import Phaser from 'phaser';
import { COLORS, HEIGHT, LEADERBOARD_NAME_KEY, WIDTH } from '../config';
import { levelCount } from '../data/levels';
import {
  buildEffectsHud,
  expiryBlinkAlpha,
  remainingMs,
} from '../logic/powerUpCountdown';
import {
  LEADERBOARD_NAME_MAX,
  LEADERBOARD_TOP_N,
  sanitizeName,
  type RankedEntry,
} from '../logic/leaderboardRules';
import { updateHighScore } from '../systems/ProgressSave';
import {
  fetchLeaderboard,
  submitScore,
} from '../systems/LeaderboardClient';
import {
  closeNameEntry,
  isNameEntryOpen,
  openNameEntry,
} from '../systems/NameEntryDom';

export type OverlayMode =
  | 'none'
  | 'levelComplete'
  | 'gameOver'
  | 'victory'
  | 'leaderboard';

type VictoryPhase = 'name' | 'submitting' | 'board' | 'leave';

export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  /** Left-rail timed power indicators (one text line each). */
  private effectLineTexts: Phaser.GameObjects.Text[] = [];
  private overlay?: Phaser.GameObjects.Container;
  private confetti?: Phaser.GameObjects.Particles.ParticleEmitter;
  private victoryPhase: VictoryPhase = 'name';
  private statusLine?: Phaser.GameObjects.Text;

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

    this.refreshFromRegistry();
    this.refreshEffects();

    this.registry.events.on('changedata', this.onRegistryChange, this);

    this.events.on('shutdown', () => {
      this.registry.events.off('changedata', this.onRegistryChange, this);
      closeNameEntry();
      this.clearOverlay();
    });

    // Show any overlay already requested before UIScene finished launching
    const pending = this.registry.get('uiOverlay') as OverlayMode | undefined;
    if (pending && pending !== 'none') {
      this.showOverlay(pending);
    }
  }

  /**
   * SPACE / tap while victory is up.
   * @returns true when the run should return to the main menu.
   */
  tryAdvanceVictory(): boolean {
    if (isNameEntryOpen()) return false;
    if (this.victoryPhase === 'submitting') return false;
    if (this.victoryPhase === 'board' || this.victoryPhase === 'leave') {
      closeNameEntry();
      this.victoryPhase = 'leave';
      return true;
    }
    return false;
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
      key === 'effectExplode' ||
      key === 'effectGlueExpires' ||
      key === 'effectBulletExpires' ||
      key === 'effectLaserExpires' ||
      key === 'effectSlowExpires' ||
      key === 'effectExplodeExpires'
    ) {
      this.refreshEffects(this.time.now);
    }
    if (key === 'uiOverlay') {
      this.showOverlay((value as OverlayMode) ?? 'none');
    }
  }

  update(time: number): void {
    // Live countdown + blink while any timed power is active
    const glue = Boolean(this.registry.get('effectGlue'));
    const bullet = Boolean(this.registry.get('effectBullet'));
    const laser = Boolean(this.registry.get('effectLaser'));
    const slow = Boolean(this.registry.get('effectSlow'));
    const explode = Boolean(this.registry.get('effectExplode'));
    if (glue || bullet || laser || slow || explode) {
      this.refreshEffects(time);
    } else if (this.effectLineTexts.some((t) => t.visible)) {
      this.refreshEffects(time);
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

  private effectColor(label: string): string {
    switch (label) {
      case 'GLUE':
        return '#26a69a';
      case 'BULLET':
        return '#ff7043';
      case 'LASER':
        return '#ff5252';
      case 'SLOW':
        return '#29b6f6';
      case 'BLAST':
        return '#ffc107';
      default:
        return '#ffd54f';
    }
  }

  private ensureEffectLine(index: number): Phaser.GameObjects.Text {
    let text = this.effectLineTexts[index];
    if (text) return text;
    text = this.add
      .text(16, 40, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffd54f',
      })
      .setOrigin(0, 0)
      .setDepth(10)
      .setVisible(false);
    this.effectLineTexts[index] = text;
    return text;
  }

  private refreshEffects(nowMs = this.time.now): void {
    const glue = Boolean(this.registry.get('effectGlue'));
    const bullet = Boolean(this.registry.get('effectBullet'));
    const laser = Boolean(this.registry.get('effectLaser'));
    const slow = Boolean(this.registry.get('effectSlow'));
    const explode = Boolean(this.registry.get('effectExplode'));

    const glueExp = (this.registry.get('effectGlueExpires') as number) ?? 0;
    const bulletExp = (this.registry.get('effectBulletExpires') as number) ?? 0;
    const laserExp = (this.registry.get('effectLaserExpires') as number) ?? 0;
    const slowExp = (this.registry.get('effectSlowExpires') as number) ?? 0;
    const explodeExp =
      (this.registry.get('effectExplodeExpires') as number) ?? 0;

    const hud = buildEffectsHud([
      {
        label: 'GLUE',
        remainingMs: glue ? remainingMs(glueExp, nowMs) : 0,
      },
      {
        label: 'BULLET',
        remainingMs: bullet ? remainingMs(bulletExp, nowMs) : 0,
      },
      {
        label: 'LASER',
        remainingMs: laser ? remainingMs(laserExp, nowMs) : 0,
      },
      {
        label: 'SLOW',
        remainingMs: slow ? remainingMs(slowExp, nowMs) : 0,
      },
      {
        label: 'BLAST',
        remainingMs: explode ? remainingMs(explodeExp, nowMs) : 0,
      },
    ]);

    // Left vertical stack under the score
    const lineH = 18;
    const startY = 40;
    for (let i = 0; i < hud.entries.length; i++) {
      const entry = hud.entries[i]!;
      const text = this.ensureEffectLine(i);
      text
        .setText(entry.line)
        .setPosition(16, startY + i * lineH)
        .setColor(this.effectColor(entry.label))
        .setAlpha(expiryBlinkAlpha(nowMs, entry.remainingMs))
        .setVisible(true);
    }
    for (let i = hud.entries.length; i < this.effectLineTexts.length; i++) {
      this.effectLineTexts[i]?.setVisible(false).setText('');
    }
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
    closeNameEntry();
    if (mode === 'none') return;

    if (mode === 'victory') {
      this.buildVictoryOverlay();
      return;
    }
    if (mode === 'leaderboard') {
      void this.buildLeaderboardOverlay();
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

  private loadSavedName(): string {
    try {
      return sanitizeName(localStorage.getItem(LEADERBOARD_NAME_KEY) ?? '');
    } catch {
      return '';
    }
  }

  private saveName(name: string): void {
    try {
      localStorage.setItem(LEADERBOARD_NAME_KEY, name);
    } catch {
      /* private mode */
    }
  }

  private buildVictoryOverlay(): void {
    this.victoryPhase = 'name';
    const score = (this.registry.get('score') as number) ?? 0;
    const high = (this.registry.get('highScore') as number) ?? 0;
    const lives = (this.registry.get('lives') as number) ?? 0;
    const clearBonus = (this.registry.get('victoryClearBonus') as number) ?? 0;
    const lifeBonus = (this.registry.get('victoryLifeBonus') as number) ?? 0;
    const isNewHigh = score >= high && score > 0;

    const container = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(1000);

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

    this.statusLine = this.add
      .text(0, 118, 'Enter your name for the global board', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#90a4ae',
      })
      .setOrigin(0.5);
    nodes.push(this.statusLine);

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

    // Name field after confetti starts — DOM sits above the canvas
    this.time.delayedCall(280, () => {
      if (this.victoryPhase !== 'name') return;
      openNameEntry({
        title: 'ENTER YOUR NAME',
        placeholder: 'NAME',
        maxLength: LEADERBOARD_NAME_MAX,
        initial: this.loadSavedName(),
        submitLabel: 'SUBMIT SCORE',
        skipLabel: 'SKIP',
        onSubmit: (raw) => {
          void this.onVictoryNameSubmit(raw, score);
        },
        onSkip: () => {
          this.victoryPhase = 'leave';
          this.registry.set('forceMenu', true);
        },
      });
    });
  }

  private async onVictoryNameSubmit(raw: string, score: number): Promise<void> {
    const name = sanitizeName(raw);
    if (!name) {
      this.statusLine?.setText('Name required — try again');
      this.victoryPhase = 'name';
      openNameEntry({
        title: 'ENTER YOUR NAME',
        placeholder: 'NAME',
        maxLength: LEADERBOARD_NAME_MAX,
        initial: '',
        submitLabel: 'SUBMIT SCORE',
        skipLabel: 'SKIP',
        onSubmit: (n) => {
          void this.onVictoryNameSubmit(n, score);
        },
        onSkip: () => {
          this.victoryPhase = 'leave';
          this.registry.set('forceMenu', true);
        },
      });
      return;
    }

    this.victoryPhase = 'submitting';
    this.saveName(name);
    this.statusLine?.setText('Submitting score…');
    this.statusLine?.setColor('#4fc3f7');

    const result = await submitScore(name, score);
    if (result.error || !result.entries) {
      this.statusLine?.setText(result.error ?? 'Submit failed');
      this.statusLine?.setColor('#ef5350');
      // Still show board (maybe empty) so player can leave
      const fallback = await fetchLeaderboard();
      this.showBoardAfterVictory(
        fallback.entries,
        undefined,
        result.error ?? 'Could not submit — board is view-only',
      );
      return;
    }

    this.showBoardAfterVictory(
      result.entries,
      result.rank,
      result.rank
        ? `You placed  #${result.rank}  ·  ${name}  ${score}`
        : `Submitted as ${name}`,
    );
  }

  private showBoardAfterVictory(
    entries: RankedEntry[],
    playerRank: number | undefined,
    subtitle: string,
  ): void {
    this.victoryPhase = 'board';
    closeNameEntry();
    this.clearOverlay();
    this.buildLeaderboardPanel({
      title: 'TOP MASTERS',
      subtitle,
      entries,
      highlightRank: playerRank,
      hint: 'Press SPACE / TAP  ·  return to menu',
    });
  }

  private async buildLeaderboardOverlay(): Promise<void> {
    const loading = this.add
      .text(WIDTH / 2, HEIGHT / 2, 'Loading leaderboard…', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#90a4ae',
      })
      .setOrigin(0.5)
      .setDepth(1000);

    const { entries, error } = await fetchLeaderboard();
    loading.destroy();

    this.buildLeaderboardPanel({
      title: 'TOP MASTERS',
      subtitle: error
        ? error
        : entries.length === 0
          ? `No scores yet — clear all ${levelCount()} levels!`
          : `Top ${LEADERBOARD_TOP_N} campaign clears`,
      entries,
      hint: 'Press SPACE / TAP  ·  close',
    });
  }

  private buildLeaderboardPanel(opts: {
    title: string;
    subtitle: string;
    entries: RankedEntry[];
    highlightRank?: number;
    hint: string;
  }): void {
    const container = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(1000);
    const veil = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x050510, 0.88);

    const panelW = Math.min(WIDTH * 0.92, 560);
    const panelH = Math.min(HEIGHT * 0.9, 520);
    const panel = this.add
      .rectangle(0, 0, panelW, panelH, 0x0a1220, 0.97)
      .setStrokeStyle(3, 0x4fc3f7, 1);

    const title = this.add
      .text(0, -panelH / 2 + 36, opts.title, {
        fontFamily: 'monospace',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#4fc3f7',
        stroke: '#001018',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(0, -panelH / 2 + 68, opts.subtitle, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffd54f',
        align: 'center',
        wordWrap: { width: panelW - 40 },
      })
      .setOrigin(0.5);

    const header = this.add
      .text(0, -panelH / 2 + 100, ' #   NAME            SCORE', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#78909c',
      })
      .setOrigin(0.5, 0);

    const lines =
      opts.entries.length === 0
        ? ['   — empty —']
        : opts.entries.map((e) => {
            const rank = String(e.rank).padStart(2, ' ');
            const name = e.name.slice(0, 12).padEnd(12, ' ');
            const score = String(e.score).padStart(8, ' ');
            return `${rank}   ${name}  ${score}`;
          });

    const body = this.add
      .text(0, -panelH / 2 + 124, lines.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        align: 'left',
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);

    // Highlight player's row if present in top 20
    if (opts.highlightRank && opts.highlightRank <= LEADERBOARD_TOP_N) {
      const idx = opts.highlightRank - 1;
      const rowY = -panelH / 2 + 124 + idx * 21;
      const hi = this.add
        .rectangle(0, rowY + 8, panelW - 48, 20, 0x1565c0, 0.35)
        .setOrigin(0.5);
      container.add(hi);
    }

    const hint = this.add
      .text(0, panelH / 2 - 28, opts.hint, {
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

    container.add([veil, panel, title, subtitle, header, body, hint]);
    this.overlay = container;
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
    this.time.delayedCall(3500, () => {
      this.confetti?.stop();
    });
  }

  private clearOverlay(): void {
    this.overlay?.destroy(true);
    this.overlay = undefined;
    this.confetti?.destroy();
    this.confetti = undefined;
    this.statusLine = undefined;
  }
}
