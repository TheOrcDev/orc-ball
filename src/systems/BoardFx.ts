import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import {
  getFxTheme,
  type ActiveFxFlags,
  type FxTheme,
} from '../logic/fxTheme';

/**
 * 3D-ish arena frame + power-reactive FX.
 * Electric themes use lightning; GLUE uses viscous slime drips/strands.
 */
export class BoardFx {
  private bg!: Phaser.GameObjects.Graphics;
  private walls!: Phaser.GameObjects.Graphics;
  private bolts!: Phaser.GameObjects.Graphics;
  private floor!: Phaser.GameObjects.Graphics;
  private goo!: Phaser.GameObjects.Graphics;
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
  private dripPhase = 0;
  private lastFlags: ActiveFxFlags = {
    sticky: false,
    fireball: false,
    expand: false,
    shrink: false,
    laser: false,
    slow: false,
    explode: false,
  };

  constructor(scene: Phaser.Scene) {
    this.bg = scene.add.graphics().setDepth(-20);
    this.floor = scene.add.graphics().setDepth(-15);
    this.walls = scene.add.graphics().setDepth(-10);
    this.goo = scene.add.graphics().setDepth(-7);
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
    this.redrawDynamic();
  }

  /** Call when power-up flags change. */
  setEffects(flags: ActiveFxFlags, nowMs = 0): void {
    this.lastFlags = {
      sticky: flags.sticky,
      fireball: flags.fireball,
      expand: flags.expand,
      shrink: flags.shrink,
      laser: Boolean(flags.laser),
      slow: Boolean(flags.slow),
      explode: Boolean(flags.explode),
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
      this.redrawDynamic();
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
    if (!this.ambient) return;

    this.ambient.setParticleTint(theme.sparkTint);
    this.ambient.frequency = theme.particleFrequency;

    if (theme.style === 'glue') {
      // Slow falling goo droplets
      this.ambient.setConfig({
        x: { min: 16, max: WIDTH - 16 },
        y: { min: 24, max: 80 },
        speedX: { min: -12, max: 12 },
        speedY: { min: 35, max: 90 },
        lifespan: { min: 1200, max: 2200 },
        scale: { start: 1.1, end: 0.2 },
        alpha: { start: 0.75, end: 0.05 },
        quantity: 1,
        frequency: theme.particleFrequency,
        blendMode: 'NORMAL',
        gravityY: 40,
      });
      this.edgeSparks?.setConfig({
        speed: { min: 10, max: 40 },
        speedY: { min: 20, max: 70 },
        lifespan: 500,
        scale: { start: 1.2, end: 0.1 },
        alpha: { start: 0.85, end: 0 },
        blendMode: 'NORMAL',
      });
    } else {
      this.ambient.setConfig({
        x: { min: 20, max: WIDTH - 20 },
        y: { min: 40, max: HEIGHT - 80 },
        speed: { min: 8, max: 40 },
        speedX: undefined,
        speedY: undefined,
        lifespan: { min: 800, max: 1800 },
        scale: { start: 0.45, end: 0 },
        alpha: { start: 0.55, end: 0 },
        quantity: 1,
        frequency: theme.particleFrequency,
        blendMode: 'ADD',
        gravityY: 0,
      });
      this.edgeSparks?.setConfig({
        speed: { min: 40, max: 120 },
        lifespan: 350,
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.9, end: 0 },
        blendMode: 'ADD',
        gravityY: 0,
      });
    }

    if (this.edgeSparks) {
      this.edgeSparks.setParticleTint(theme.sparkTint);
    }
  }

  update(time: number, delta: number): void {
    this.pulse += delta * 0.004;
    this.dripPhase += delta * 0.002;

    if (this.multiPulseUntil > 0 && time >= this.multiPulseUntil) {
      this.multiPulseUntil = 0;
      this.setEffects(this.lastFlags, time);
    }

    this.boltTimer += delta;
    if (this.boltTimer >= this.theme.boltFrequencyMs) {
      this.boltTimer = 0;
      this.redrawDynamic();
      if (Math.random() < 0.35 * this.theme.wallIntensity) {
        this.burstEdgeSparks();
      }
    }

    if (this.theme.style === 'glue') {
      // Slow pulse on goo layer
      const a = 0.85 + Math.sin(this.pulse * 0.7) * 0.12;
      this.goo.setAlpha(a);
      this.bolts.setAlpha(0.7 + Math.sin(this.pulse) * 0.15);
    } else {
      this.goo.setAlpha(0);
      const pulseA =
        0.75 + Math.sin(this.pulse) * 0.2 * this.theme.wallIntensity;
      this.bolts.setAlpha(pulseA);
    }
  }

  /** Snap on brick break / paddle hit. */
  crackleAt(x: number, y: number): void {
    this.edgeSparks?.setParticleTint(this.theme.sparkTint);
    this.edgeSparks?.explode(
      this.theme.style === 'glue' ? 6 : 10,
      x,
      y,
    );
    if (this.theme.style === 'glue') {
      // Goo splat blob
      this.goo.fillStyle(this.theme.primary, 0.45);
      this.goo.fillCircle(x, y, 6 + Math.random() * 8);
      this.goo.fillStyle(this.theme.secondary, 0.35);
      this.goo.fillCircle(x + 4, y + 6, 4);
    } else {
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
    this.bg.fillStyle(0x000000, 0.35);
    this.bg.fillRect(0, 0, WIDTH, 18);
    this.bg.fillRect(0, HEIGHT - 30, WIDTH, 30);

    // Glue haze overlay on the playfield
    if (t.style === 'glue') {
      this.bg.fillStyle(t.primary, 0.06);
      this.bg.fillRect(12, 24, WIDTH - 24, HEIGHT - 50);
      // Sticky splotches on the field
      for (let i = 0; i < 14; i++) {
        const sx = 40 + Math.random() * (WIDTH - 80);
        const sy = 60 + Math.random() * (HEIGHT - 160);
        const r = 8 + Math.random() * 22;
        this.bg.fillStyle(t.glow, 0.12 + Math.random() * 0.1);
        this.bg.fillCircle(sx, sy, r);
        this.bg.fillStyle(t.primary, 0.05);
        this.bg.fillCircle(sx - r * 0.2, sy - r * 0.2, r * 0.55);
      }
    }

    this.floor.clear();
    if (t.style === 'glue') {
      // Thick goo puddle on the floor
      this.floor.fillStyle(t.glow, 0.35);
      this.floor.fillEllipse(WIDTH / 2, HEIGHT - 8, WIDTH * 0.92, 36);
      this.floor.fillStyle(t.primary, 0.22);
      this.floor.fillEllipse(WIDTH / 2, HEIGHT - 14, WIDTH * 0.7, 22);
      this.floor.fillStyle(t.secondary, 0.15);
      this.floor.fillEllipse(WIDTH / 2 - 40, HEIGHT - 18, 120, 14);
      // Surface shine
      this.floor.fillStyle(0xffffff, 0.08);
      this.floor.fillEllipse(WIDTH / 2 - 60, HEIGHT - 20, 80, 6);
    } else {
      this.floor.fillStyle(t.glow, 0.12);
      this.floor.fillTriangle(0, HEIGHT, WIDTH, HEIGHT, WIDTH / 2, HEIGHT - 70);
      this.floor.lineStyle(2, t.primary, 0.2);
      this.floor.lineBetween(40, HEIGHT - 8, WIDTH - 40, HEIGHT - 8);
      for (let i = 0; i < 5; i++) {
        const y = HEIGHT - 12 - i * 10;
        const inset = i * 28;
        this.floor.lineStyle(1, t.primary, 0.08 + i * 0.02);
        this.floor.lineBetween(inset, y, WIDTH - inset, y);
      }
    }

    this.walls.clear();
    const rail = t.style === 'glue' ? 14 : 10;

    if (t.style === 'glue') {
      this.drawGlueRails(t, rail);
    } else {
      this.drawElectricRails(t, rail);
    }
  }

  private drawElectricRails(t: FxTheme, rail: number): void {
    this.walls.fillStyle(t.glow, 0.85);
    this.walls.fillRect(0, 20, rail, HEIGHT - 50);
    this.walls.fillStyle(t.primary, 0.55);
    this.walls.fillRect(0, 20, 3, HEIGHT - 50);
    this.walls.fillStyle(0x000000, 0.35);
    this.walls.fillRect(rail - 2, 20, 2, HEIGHT - 50);

    this.walls.fillStyle(t.glow, 0.85);
    this.walls.fillRect(WIDTH - rail, 20, rail, HEIGHT - 50);
    this.walls.fillStyle(t.primary, 0.55);
    this.walls.fillRect(WIDTH - 3, 20, 3, HEIGHT - 50);
    this.walls.fillStyle(0x000000, 0.35);
    this.walls.fillRect(WIDTH - rail, 20, 2, HEIGHT - 50);

    this.walls.fillStyle(t.glow, 0.9);
    this.walls.fillRect(0, 0, WIDTH, 22);
    this.walls.fillStyle(t.primary, 0.5);
    this.walls.fillRect(0, 0, WIDTH, 4);
    this.walls.fillStyle(0xffffff, 0.15);
    this.walls.fillRect(0, 4, WIDTH, 2);
    this.walls.fillStyle(0x000000, 0.4);
    this.walls.fillRect(0, 20, WIDTH, 3);
    this.walls.fillStyle(0x000000, 0.25);
    this.walls.fillRect(rail, 22, WIDTH - rail * 2, 6);
  }

  private drawGlueRails(t: FxTheme, rail: number): void {
    // Thick slime coating on side rails
    this.walls.fillStyle(t.glow, 0.95);
    this.walls.fillRect(0, 18, rail, HEIGHT - 40);
    this.walls.fillStyle(t.primary, 0.55);
    this.walls.fillRect(2, 20, rail - 3, HEIGHT - 48);
    this.walls.fillStyle(t.secondary, 0.35);
    this.walls.fillRect(1, 22, 4, HEIGHT - 52);

    this.walls.fillStyle(t.glow, 0.95);
    this.walls.fillRect(WIDTH - rail, 18, rail, HEIGHT - 40);
    this.walls.fillStyle(t.primary, 0.55);
    this.walls.fillRect(WIDTH - rail + 1, 20, rail - 3, HEIGHT - 48);
    this.walls.fillStyle(t.secondary, 0.35);
    this.walls.fillRect(WIDTH - 5, 22, 4, HEIGHT - 52);

    // Gooey top bar (melted edge)
    this.walls.fillStyle(t.glow, 0.95);
    this.walls.fillRect(0, 0, WIDTH, 26);
    this.walls.fillStyle(t.primary, 0.5);
    this.walls.fillRect(0, 0, WIDTH, 10);
    this.walls.fillStyle(0xffffff, 0.12);
    this.walls.fillRect(0, 4, WIDTH, 3);

    // Dripping scallops along top lip
    for (let x = 12; x < WIDTH; x += 28) {
      const len = 10 + (x % 40) * 0.2;
      this.walls.fillStyle(t.primary, 0.65);
      this.walls.fillCircle(x, 24 + len * 0.3, 5 + (x % 7) * 0.3);
      this.walls.fillStyle(t.secondary, 0.4);
      this.walls.fillTriangle(x - 6, 22, x + 6, 22, x, 28 + len);
    }

    // Inner sticky lip
    this.walls.fillStyle(t.glow, 0.35);
    this.walls.fillRect(rail, 26, WIDTH - rail * 2, 8);
  }

  private redrawDynamic(): void {
    this.bolts.clear();
    this.goo.clear();
    if (this.theme.style === 'glue') {
      this.redrawGlue();
    } else {
      this.redrawBolts();
    }
  }

  private redrawBolts(): void {
    const t = this.theme;
    const j = t.boltJitter;

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
    this.drawBolt(
      this.bolts,
      20,
      12,
      WIDTH - 20,
      12,
      10,
      j * 0.5,
      t.secondary,
      1.5,
    );

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

  /** Viscous drips, blobs, and stretchy strands — the board looks glued. */
  private redrawGlue(): void {
    const t = this.theme;
    const phase = this.dripPhase;

    // Side slime drips (long teardrops sliding down)
    for (let i = 0; i < 7; i++) {
      const yBase = 40 + ((i * 73 + phase * 40) % (HEIGHT - 100));
      this.drawDrip(this.goo, 10, yBase, 8 + (i % 3) * 3, t);
      this.drawDrip(this.goo, WIDTH - 10, yBase + 20, 7 + (i % 4) * 2, t);
    }

    // Top curtain of hanging goo
    for (let x = 30; x < WIDTH - 20; x += 36) {
      const hang = 18 + Math.sin(phase + x * 0.05) * 8 + (x % 17);
      this.drawDrip(this.goo, x, 28, hang, t);
    }

    // Stretchy strands across the upper field (like sticky webs)
    for (let i = 0; i < 4; i++) {
      if (Math.random() > 0.7) continue;
      const y = 70 + i * 55 + Math.sin(phase + i) * 10;
      const sag = 12 + Math.random() * 18;
      this.drawGooStrand(
        this.goo,
        14,
        y,
        WIDTH - 14,
        y + (Math.random() - 0.5) * 20,
        sag,
        t,
      );
    }

    // Random floor splatters climbing a bit up
    for (let i = 0; i < 5; i++) {
      const x = 50 + Math.random() * (WIDTH - 100);
      const r = 10 + Math.random() * 16;
      this.goo.fillStyle(t.primary, 0.2 + Math.random() * 0.15);
      this.goo.fillEllipse(x, HEIGHT - 20, r * 2.2, r);
      this.goo.fillStyle(t.secondary, 0.15);
      this.goo.fillCircle(x, HEIGHT - 28 - Math.random() * 20, r * 0.4);
    }
  }

  private drawDrip(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    length: number,
    t: FxTheme,
  ): void {
    // Body
    g.fillStyle(t.primary, 0.55);
    g.fillTriangle(x - 5, y, x + 5, y, x, y + length);
    g.fillStyle(t.secondary, 0.4);
    g.fillCircle(x, y + length, 4 + length * 0.08);
    // Highlight
    g.fillStyle(0xffffff, 0.12);
    g.fillCircle(x - 1, y + length * 0.4, 2);
  }

  private drawGooStrand(
    g: Phaser.GameObjects.Graphics,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    sag: number,
    t: FxTheme,
  ): void {
    const midX = (x0 + x1) / 2;
    const midY = (y0 + y1) / 2 + sag;
    // Thick outer slime
    g.lineStyle(6, t.glow, 0.35);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(midX, midY);
    g.lineTo(x1, y1);
    g.strokePath();
    g.lineStyle(3, t.primary, 0.65);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(midX, midY);
    g.lineTo(x1, y1);
    g.strokePath();
    // Droplet at lowest point
    g.fillStyle(t.secondary, 0.5);
    g.fillCircle(midX, midY + 2, 5);
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
    g.lineStyle(width + 3, color, 0.15);
    this.strokeZigzag(g, x0, y0, x1, y1, segments, jitter * 1.1);
    g.lineStyle(width, color, 0.85);
    this.strokeZigzag(g, x0, y0, x1, y1, segments, jitter);
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
    this.goo.destroy();
    this.ambient?.destroy();
    this.edgeSparks?.destroy();
  }

  get currentTheme(): FxTheme {
    return this.theme;
  }
}
