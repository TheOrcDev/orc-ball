import { expiryBlinkAlpha, remainingMs } from './powerUpCountdown';

/**
 * Single registry payload for the timed effects rendered by UIScene.
 * GameScene publishes a new snapshot whenever one of these values changes.
 */
export interface EffectSnapshot {
  glue: boolean;
  bullet: boolean;
  laser: boolean;
  slow: boolean;
  explode: boolean;
  glueExpires: number;
  bulletExpires: number;
  laserExpires: number;
  slowExpires: number;
  explodeExpires: number;
}

export function createEmptyEffectSnapshot(): EffectSnapshot {
  return {
    glue: false,
    bullet: false,
    laser: false,
    slow: false,
    explode: false,
    glueExpires: 0,
    bulletExpires: 0,
    laserExpires: 0,
    slowExpires: 0,
    explodeExpires: 0,
  };
}

export type EffectHudLabel = 'GLUE' | 'BULLET' | 'LASER' | 'SLOW' | 'BLAST';

/**
 * Values which affect one Phaser Text line. Keeping the displayed second,
 * label, and color explicit lets the scene avoid rerasterizing unchanged text.
 */
export interface EffectHudRenderLine {
  label: EffectHudLabel;
  displayedSeconds: number;
  color: string;
  alpha: number;
}

export interface EffectHudLinePatch {
  index: number;
  text?: string;
  color?: string;
  alpha?: number;
  visible?: boolean;
}

type ActiveKey = 'glue' | 'bullet' | 'laser' | 'slow' | 'explode';
type ExpiresKey =
  | 'glueExpires'
  | 'bulletExpires'
  | 'laserExpires'
  | 'slowExpires'
  | 'explodeExpires';

interface EffectHudDefinition {
  activeKey: ActiveKey;
  expiresKey: ExpiresKey;
  label: EffectHudLabel;
  color: string;
}

const EFFECT_HUD_DEFINITIONS: readonly EffectHudDefinition[] = [
  {
    activeKey: 'glue',
    expiresKey: 'glueExpires',
    label: 'GLUE',
    color: '#26a69a',
  },
  {
    activeKey: 'bullet',
    expiresKey: 'bulletExpires',
    label: 'BULLET',
    color: '#ff7043',
  },
  {
    activeKey: 'laser',
    expiresKey: 'laserExpires',
    label: 'LASER',
    color: '#ff5252',
  },
  {
    activeKey: 'slow',
    expiresKey: 'slowExpires',
    label: 'SLOW',
    color: '#29b6f6',
  },
  {
    activeKey: 'explode',
    expiresKey: 'explodeExpires',
    label: 'BLAST',
    color: '#ffc107',
  },
];

const SNAPSHOT_BOOLEAN_KEYS: readonly ActiveKey[] = [
  'glue',
  'bullet',
  'laser',
  'slow',
  'explode',
];

const SNAPSHOT_NUMBER_KEYS: readonly ExpiresKey[] = [
  'glueExpires',
  'bulletExpires',
  'laserExpires',
  'slowExpires',
  'explodeExpires',
];

/** Runtime guard for the registry boundary. */
export function isEffectSnapshot(value: unknown): value is EffectSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    SNAPSHOT_BOOLEAN_KEYS.every((key) => typeof candidate[key] === 'boolean') &&
    SNAPSHOT_NUMBER_KEYS.every((key) => typeof candidate[key] === 'number')
  );
}

export function hasLiveHudEffect(
  snapshot: Readonly<EffectSnapshot>,
  nowMs: number,
): boolean {
  return EFFECT_HUD_DEFINITIONS.some(
    ({ activeKey, expiresKey }) =>
      snapshot[activeKey] && remainingMs(snapshot[expiresKey], nowMs) > 0,
  );
}

/**
 * Derives the small render state used by UIScene. This may run every frame;
 * Text setters are driven only by the diff below.
 */
export function buildEffectHudRenderState(
  snapshot: Readonly<EffectSnapshot>,
  nowMs: number,
): EffectHudRenderLine[] {
  const lines: EffectHudRenderLine[] = [];
  for (const definition of EFFECT_HUD_DEFINITIONS) {
    if (!snapshot[definition.activeKey]) continue;
    const remaining = remainingMs(snapshot[definition.expiresKey], nowMs);
    if (remaining <= 0) continue;
    lines.push({
      label: definition.label,
      displayedSeconds: Math.ceil(remaining / 1000),
      color: definition.color,
      alpha: expiryBlinkAlpha(nowMs, remaining),
    });
  }
  return lines;
}

function lineText(line: EffectHudRenderLine): string {
  return `${line.label} ${line.displayedSeconds}s`;
}

/**
 * Produces only the Phaser Text mutations required to reach `next`.
 * Text/color changes rerasterize a canvas texture, while alpha is GPU-only.
 */
export function diffEffectHudRenderState(
  previous: readonly EffectHudRenderLine[],
  next: readonly EffectHudRenderLine[],
): EffectHudLinePatch[] {
  const patches: EffectHudLinePatch[] = [];
  const lineCount = Math.max(previous.length, next.length);

  for (let index = 0; index < lineCount; index++) {
    const before = previous[index];
    const after = next[index];

    if (!after) {
      if (before) patches.push({ index, visible: false });
      continue;
    }

    if (!before) {
      patches.push({
        index,
        text: lineText(after),
        color: after.color,
        alpha: after.alpha,
        visible: true,
      });
      continue;
    }

    const patch: EffectHudLinePatch = { index };
    if (
      before.label !== after.label ||
      before.displayedSeconds !== after.displayedSeconds
    ) {
      patch.text = lineText(after);
    }
    if (before.color !== after.color) patch.color = after.color;
    if (before.alpha !== after.alpha) patch.alpha = after.alpha;

    if (
      patch.text !== undefined ||
      patch.color !== undefined ||
      patch.alpha !== undefined
    ) {
      patches.push(patch);
    }
  }

  return patches;
}
