import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import {
  getFxTheme,
  type ActiveFxFlags,
  type FxTheme,
} from '../logic/fxTheme';

/**
 * 3D-ish arena frame + power-reactive electricity.
 * Drawn with Graphics (no binary assets).
 */
export class BoardFx {
  private bg!: Phaser.GameObjects.Graphics;
  private walls!: Phaser.GameObjects.Graphics;
  private bolts!: Phaser.GameObjects.Graphics;
  private floor!: Phaser.GameObjects.Graphics;
  private ambient?: Phaser.GameObjects.Particles.ParticleEmitter;
  private edgeSparks?: Phaser.GameObjects.Particles.ParticleEmitter;
  private theme: FxTheme = getFxTheme({
    sticky: false,
    fireball: false,
    expand: false,
    shrink: false,
  });
  private boltTimer = 0;
  private pulse = 0;
  private multiPulseUntil = 0;
  private lastFlags: ActiveFxFlags = {
    sticky: false,
    fireball: false,
    expand: false,
    shrink: false,
  };

  constructor(scene: Phaser.Scene) {
    this.bg = scene.add.graphics().setDepth(-20);
    this.floor = scene.add.graphics().setDepth(-15);
    this.walls = scene.add.graphics().setDepth(-10);
    this.bolts = scene.add.graphics().setDepth(-5);

    this.ambient = scene.add.particles(0, 0, 'particle', {
      x: { min: 20, max: WIDTH - 20 },
      y: { min: 40, max: HEIGHT - 80 },
      speed: { min: 8, max: 40 },
      lifespan: { min: 800, max: 1800 },
      scale: { start: 0.45, end: 0 },
      alpha: { start: 0.55, end: 0 },
      quantity: 1,
      frequency: this.theme.particleFrequency,
      blendMode: 'ADD',
      emitting: true,
    });
    this.ambient.setDepth(-8);

    this.edgeSparks = scene.add.particles(0, 0, 'particle', {
      speed: { min: 40, max: 120 },
      lifespan: 350,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 },
      quantity: 0,
      frequency: -1,
      blendMode: 'ADD',
      emitting: false,
    });
    this.edgeSparks.setDepth(5);

    this.applyTheme(this.theme);
    this.redrawStatic();
    this.redrawBolts();
  }

  /** Call when power-up flags change. */
  setEffects(flags: ActiveFxFlags, nowMs = 0): void {
    this.lastFlags = {
      sticky: flags.sticky,
      fireball: flags.fireball,
      expand: flags.expand,
      shrink: flags.shrink,
    };
    if (flags.multiPulse) {
      this.multiPulseUntil = nowMs + 900;
    }
    const effective: ActiveFxFlags = {
      ...this.lastFlags,
      multiPulse: Boolean(flags.multiPulse) || nowMs < this.multiPulseUntil,
    };
    const next = getFxTheme(effective);
    if (next.id !== this.theme.id) {
      this.applyTheme(next);
      this.redrawStatic();
    } else {
      this.theme = next;
    }
  }

  /** Brief multi-ball collect flash (keeps other active powers). */
  pulseMulti(nowMs: number): void {
    this.setEffects({ ...this.lastFlags, multiPulse: true }, nowMs);
  }

  private applyTheme(theme: FxTheme): void {
    this.theme = theme;
    if (this.ambient) {
      this.ambient.setParticleTint(theme.sparkTint);
      this.ambient.frequency = theme.particleFrequency;
    }
    if (this.edgeSparks) {
      this.edgeSparks.setParticleTint(theme.sparkTint);
    }
  }

  update(time: number, delta: number): void {
    this.pulse += delta * 0.004;
    // Restore base theme when multi pulse ends
    if (this.multiPulseUntil > 0 && time >= this.multiPulseUntil) {
      this.multiPulseUntil = 0;
      this.setEffects(this.lastFlags, time);
    }

    this.boltTimer += delta;
    if (this.boltTimer >= this.theme.boltFrequencyMs) {
      this.boltTimer = 0;
      this.redrawBolts();
      // Occasional edge spark bursts
      if (Math.random() < 0.35 * this.theme.wallIntensity) {
        this.burstEdgeSparks();
      }
    }

    // Subtle wall pulse via alpha on bolts layer
    const pulseA = 0.75 + Math.sin(this.pulse) * 0.2 * this.theme.wallIntensity;
    this.bolts.setAlpha(pulseA);
  }

  /** Lightning snap on brick break / paddle hit. */
  crackleAt(x: number, y: number): void {
    this.edgeSparks?.setParticleTint(this.theme.sparkTint);
    this.edgeSparks?.explode(10, x, y);
    // One-shot bolt through the point
    this.drawBolt(
      this.bolts,
      x - 40,
      y,
      x + 40,
      y,
      5,
      this.theme.boltJitter * 0.6,
      this.theme.secondary,
      1.5,
    );
  }

  private burstEdgeSparks(): void {
    if (!this.edgeSparks) return;
    const side = Math.floor(Math.random() * 3);
    let x = 8;
    let y = HEIGHT / 2;
    if (side === 0) {
      x = 6;
      y = 40 + Math.random() * (HEIGHT - 100);
    } else if (side === 1) {
      x = WIDTH - 6;
      y = 40 + Math.random() * (HEIGHT - 100);
    } else {
      x = 40 + Math.random() * (WIDTH - 80);
      y = 28;
    }
    this.edgeSparks.explode(4 + Math.floor(Math.random() * 5), x, y);
  }

  private redrawStatic(): void {
    const t = this.theme;
    this.bg.clear();
    // Vertical gradient background (faux 3D depth)
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(t.bgTop),
        Phaser.Display.Color.IntegerToColor(t.bgBottom),
        steps - 1,
        i,
      );
      const color = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
      this.bg.fillStyle(color, 1);
      this.bg.fillRect(0, (HEIGHT / steps) * i, WIDTH, HEIGHT / steps + 1);
    }
    // Soft vignette corners
    this.bg.fillStyle(0x000000, 0.35);
    this.bg.fillRect(0, 0, WIDTH, 18);
    this.bg.fillRect(0, HEIGHT - 30, WIDTH, 30);

    // Floor plane (perspective strip under playfield)
    this.floor.clear();
    this.floor.fillStyle(t.glow, 0.12);
    this.floor.fillTriangle(0, HEIGHT, WIDTH, HEIGHT, WIDTH / 2, HEIGHT - 70);
    this.floor.lineStyle(2, t.primary, 0.2);
    this.floor.lineBetween(40, HEIGHT - 8, WIDTH - 40, HEIGHT - 8);
    // Grid lines receding
    for (let i = 0; i < 5; i++) {
      const y = HEIGHT - 12 - i * 10;
      const inset = i * 28;
      this.floor.lineStyle(1, t.primary, 0.08 + i * 0.02);
      this.floor.lineBetween(inset, y, WIDTH - inset, y);
    }

    // Beveled walls (3D rails)
    this.walls.clear();
    const rail = 10;
    // Left rail
    this.walls.fillStyle(t.glow, 0.85);
    this.walls.fillRect(0, 20, rail, HEIGHT - 50);
    this.walls.fillStyle(t.primary, 0.55);
    this.walls.fillRect(0, 20, 3, HEIGHT - 50);
    this.walls.fillStyle(0x000000, 0.35);
    this.walls.fillRect(rail - 2, 20, 2, HEIGHT - 50);
    // Right rail
    this.walls.fillStyle(t.glow, 0.85);
    this.walls.fillRect(WIDTH - rail, 20, rail, HEIGHT - 50);
    this.walls.fillStyle(t.primary, 0.55);
    this.walls.fillRect(WIDTH - 3, 20, 3, HEIGHT - 50);
    this.walls.fillStyle(0x000000, 0.35);
    this.walls.fillRect(WIDTH - rail, 20, 2, HEIGHT - 50);
    // Top header bar with thickness
    this.walls.fillStyle(t.glow, 0.9);
    this.walls.fillRect(0, 0, WIDTH, 22);
    this.walls.fillStyle(t.primary, 0.5);
    this.walls.fillRect(0, 0, WIDTH, 4);
    this.walls.fillStyle(0xffffff, 0.15);
    this.walls.fillRect(0, 4, WIDTH, 2);
    this.walls.fillStyle(0x000000, 0.4);
    this.walls.fillRect(0, 20, WIDTH, 3);
    // Inner lip (gutter shadow for depth)
    this.walls.fillStyle(0x000000, 0.25);
    this.walls.fillRect(rail, 22, WIDTH - rail * 2, 6);
  }

  private redrawBolts(): void {
    this.bolts.clear();
    const t = this.theme;
    const j = t.boltJitter;

    // Side energy conduits
    this.drawBolt(this.bolts, 5, 30, 5, HEIGHT - 50, 8, j, t.primary, 2);
    this.drawBolt(
      this.bolts,
      WIDTH - 5,
      30,
      WIDTH - 5,
      HEIGHT - 50,
      8,
      j,
      t.primary,
      2,
    );
    // Top arc
    this.drawBolt(this.bolts, 20, 12, WIDTH - 20, 12, 10, j * 0.5, t.secondary, 1.5);

    // Cross-field forks (more when intense)
    const forks = 1 + Math.floor(t.wallIntensity * 3);
    for (let i = 0; i < forks; i++) {
      if (Math.random() > t.wallIntensity) continue;
      const y = 50 + Math.random() * (HEIGHT * 0.45);
      const fromLeft = Math.random() < 0.5;
      const x0 = fromLeft ? 8 : WIDTH - 8;
      const x1 = fromLeft
        ? 40 + Math.random() * 120
        : WIDTH - 40 - Math.random() * 120;
      this.drawBolt(
        this.bolts,
        x0,
        y,
        x1,
        y + (Math.random() - 0.5) * 40,
        6,
        j,
        t.secondary,
        1.2,
      );
    }
  }

  private drawBolt(
    g: Phaser.GameObjects.Graphics,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    segments: number,
    jitter: number,
    color: number,
    width: number,
  ): void {
    // Outer glow
    g.lineStyle(width + 3, color, 0.15);
    this.strokeZigzag(g, x0, y0, x1, y1, segments, jitter * 1.1);
    // Core
    g.lineStyle(width, color, 0.85);
    this.strokeZigzag(g, x0, y0, x1, y1, segments, jitter);
    // Hot white core
    g.lineStyle(Math.max(1, width * 0.4), 0xffffff, 0.45);
    this.strokeZigzag(g, x0, y0, x1, y1, segments, jitter * 0.5);
  }

  private strokeZigzag(
    g: Phaser.GameObjects.Graphics,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    segments: number,
    jitter: number,
  ): void {
    g.beginPath();
    g.moveTo(x0, y0);
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      let x = x0 + (x1 - x0) * t;
      let y = y0 + (y1 - y0) * t;
      if (i < segments) {
        const nx = -(y1 - y0);
        const ny = x1 - x0;
        const len = Math.hypot(nx, ny) || 1;
        const off = (Math.random() - 0.5) * 2 * jitter;
        x += (nx / len) * off;
        y += (ny / len) * off;
      }
      g.lineTo(x, y);
    }
    g.strokePath();
  }

  destroy(): void {
    this.bg.destroy();
    this.walls.destroy();
    this.bolts.destroy();
    this.floor.destroy();
    this.ambient?.destroy();
    this.edgeSparks?.destroy();
  }

  get currentTheme(): FxTheme {
    return this.theme;
  }
}
