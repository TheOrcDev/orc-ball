/**
 * Visual FX theme driven by active power-ups.
 * Priority: BULLET > GLUE > EXPAND > SHRINK > MULTI pulse > default.
 */

export type FxThemeId =
  | 'default'
  | 'glue'
  | 'bullet'
  | 'expand'
  | 'shrink'
  | 'multi'
  | 'laser'
  | 'slow'
  | 'explode';

export interface ActiveFxFlags {
  sticky: boolean;
  fireball: boolean;
  expand: boolean;
  shrink: boolean;
  laser?: boolean;
  slow?: boolean;
  explode?: boolean;
  /** Brief multi flash after MULTIBALL collect (optional). */
  multiPulse?: boolean;
}

export type FxStyle = 'electric' | 'glue';

export interface FxTheme {
  id: FxThemeId;
  /** Rendering style: lightning vs sticky goo */
  style: FxStyle;
  /** Primary arc / border / goo color */
  primary: number;
  secondary: number;
  glow: number;
  bgTop: number;
  bgBottom: number;
  sparkTint: number[];
  boltJitter: number;
  boltFrequencyMs: number;
  particleFrequency: number;
  wallIntensity: number;
  label: string;
}

const THEMES: Record<FxThemeId, FxTheme> = {
  default: {
    id: 'default',
    style: 'electric',
    primary: 0x4fc3f7,
    secondary: 0x81d4fa,
    glow: 0x0277bd,
    bgTop: 0x0d1528,
    bgBottom: 0x05060c,
    sparkTint: [0x4fc3f7, 0xe1f5fe, 0x29b6f6],
    boltJitter: 14,
    boltFrequencyMs: 110,
    particleFrequency: 80,
    wallIntensity: 0.55,
    label: 'ARC',
  },
  /** Viscous slime look — amber-teal goo, not lightning. */
  glue: {
    id: 'glue',
    style: 'glue',
    primary: 0xc6ff00,
    secondary: 0x76ff03,
    glow: 0x33691e,
    bgTop: 0x1a2e12,
    bgBottom: 0x0a1408,
    sparkTint: [0xc6ff00, 0xaeea00, 0x64dd17, 0xeeff41],
    boltJitter: 4,
    boltFrequencyMs: 200,
    particleFrequency: 55,
    wallIntensity: 0.9,
    label: 'GLUE',
  },
  bullet: {
    id: 'bullet',
    style: 'electric',
    primary: 0xff6d00,
    secondary: 0xffab40,
    glow: 0xbf360c,
    bgTop: 0x2a1008,
    bgBottom: 0x120604,
    sparkTint: [0xff6d00, 0xffe082, 0xff3d00],
    boltJitter: 22,
    boltFrequencyMs: 70,
    particleFrequency: 40,
    wallIntensity: 0.95,
    label: 'BULLET',
  },
  expand: {
    id: 'expand',
    style: 'electric',
    primary: 0x42a5f5,
    secondary: 0x90caf9,
    glow: 0x1565c0,
    bgTop: 0x0a1628,
    bgBottom: 0x040812,
    sparkTint: [0x42a5f5, 0xbbdefb, 0x1e88e5],
    boltJitter: 12,
    boltFrequencyMs: 100,
    particleFrequency: 70,
    wallIntensity: 0.7,
    label: 'EXPAND',
  },
  shrink: {
    id: 'shrink',
    style: 'electric',
    primary: 0xe53935,
    secondary: 0xef9a9a,
    glow: 0xb71c1c,
    bgTop: 0x220a0a,
    bgBottom: 0x100404,
    sparkTint: [0xe53935, 0xffcdd2, 0xc62828],
    boltJitter: 18,
    boltFrequencyMs: 90,
    particleFrequency: 55,
    wallIntensity: 0.8,
    label: 'SHRINK',
  },
  multi: {
    id: 'multi',
    style: 'electric',
    primary: 0xab47bc,
    secondary: 0xce93d8,
    glow: 0x6a1b9a,
    bgTop: 0x1a0a22,
    bgBottom: 0x0c0410,
    sparkTint: [0xab47bc, 0xf3e5f5, 0x8e24aa],
    boltJitter: 20,
    boltFrequencyMs: 60,
    particleFrequency: 35,
    wallIntensity: 0.9,
    label: 'MULTI',
  },
  laser: {
    id: 'laser',
    style: 'electric',
    primary: 0xff1744,
    secondary: 0xff8a80,
    glow: 0xb71c1c,
    bgTop: 0x1f0a0e,
    bgBottom: 0x0c0406,
    sparkTint: [0xff1744, 0xff8a80, 0xff5252],
    boltJitter: 10,
    boltFrequencyMs: 90,
    particleFrequency: 50,
    wallIntensity: 0.75,
    label: 'LASER',
  },
  slow: {
    id: 'slow',
    style: 'electric',
    primary: 0x29b6f6,
    secondary: 0x81d4fa,
    glow: 0x0277bd,
    bgTop: 0x0a1a28,
    bgBottom: 0x040a12,
    sparkTint: [0x29b6f6, 0xb3e5fc, 0x4fc3f7],
    boltJitter: 8,
    boltFrequencyMs: 140,
    particleFrequency: 90,
    wallIntensity: 0.5,
    label: 'SLOW',
  },
  explode: {
    id: 'explode',
    style: 'electric',
    primary: 0xffc107,
    secondary: 0xffe082,
    glow: 0xff6f00,
    bgTop: 0x2a1800,
    bgBottom: 0x120a00,
    sparkTint: [0xffc107, 0xffab00, 0xff6f00, 0xffe082],
    boltJitter: 24,
    boltFrequencyMs: 55,
    particleFrequency: 35,
    wallIntensity: 0.95,
    label: 'BLAST',
  },
};

export function resolveFxThemeId(flags: ActiveFxFlags): FxThemeId {
  if (flags.explode) return 'explode';
  if (flags.fireball) return 'bullet';
  if (flags.sticky) return 'glue';
  if (flags.laser) return 'laser';
  if (flags.slow) return 'slow';
  if (flags.multiPulse) return 'multi';
  if (flags.expand) return 'expand';
  if (flags.shrink) return 'shrink';
  return 'default';
}

export function getFxTheme(flags: ActiveFxFlags): FxTheme {
  return THEMES[resolveFxThemeId(flags)];
}

export function getThemeById(id: FxThemeId): FxTheme {
  return THEMES[id];
}
