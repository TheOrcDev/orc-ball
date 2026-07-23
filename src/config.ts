/** Game and gameplay constants */

export const WIDTH = 800;
export const HEIGHT = 600;

export const PADDLE_WIDTH = 120;
export const PADDLE_HEIGHT = 20;
export const PADDLE_Y = HEIGHT - 40;
export const PADDLE_SPEED = 420;
export const PADDLE_SCALE_SHRINK = 0.6;
export const PADDLE_SCALE_NORMAL = 1;
export const PADDLE_SCALE_EXPAND = 1.5;

/** Slightly larger so the orc face stays readable as a ball. */
export const BALL_RADIUS = 10;
export const BALL_DIAMETER = BALL_RADIUS * 2;
export const DEFAULT_BALL_SPEED = 280;
export const BALL_SPEED_RAMP = 8; // per brick break
export const MAX_BALL_SPEED = 420;
export const MIN_VELOCITY_COMPONENT = 40;
/** Max degrees from vertical at paddle edge (±). DX-Ball-style strong side angles. */
export const STEER_MAX_DEG = 75;
/** Ignore paddle re-hits within this window (ms) after a steered bounce. */
export const PADDLE_HIT_COOLDOWN_MS = 120;
/** Fraction of paddle horizontal velocity blended into the ball on hit. */
export const PADDLE_VELOCITY_TRANSFER = 0.2;
export const STUCK_AUTO_LAUNCH_MS = 3000;
export const MULTIBALL_CAP = 12;
export const MULTIBALL_SPREAD_DEG = 25;
export const MAX_LIVES = 9;
export const START_LIVES = 3;

export const BRICK_WIDTH = 64;
export const BRICK_HEIGHT = 32;
export const BRICK_GAP = 2;
export const BRICK_GRID_TOP = 80;

/** Power-up capsule size — large enough for a bold letter glyph. */
export const POWERUP_SIZE = 36;
export const POWERUP_FALL_SPEED = 150;
export const POWERUP_DURATION_MS = 10000;
/** Glue / bullet last a bit longer so they feel impactful. */
export const POWERUP_DURATION_GLUE_MS = 15000;
export const POWERUP_DURATION_BULLET_MS = 12000;
export const POWERUP_DURATION_LASER_MS = 12000;
export const DEFAULT_DROP_CHANCE = 0.2;

/** Twin laser shots from paddle ends (LASER power). */
export const LASER_SPEED = 640;
export const LASER_WIDTH = 6;
export const LASER_HEIGHT = 22;
export const LASER_COOLDOWN_MS = 220;

export const COLORS = {
  bg: 0x0a0a12,
  paddle: 0x4fc3f7,
  ball: 0xffffff,
  brick1: 0x66bb6a,
  brick2: 0xffa726,
  brick3: 0xef5350,
  brickX: 0x78909c,
  expand: 0x42a5f5,
  shrink: 0xe53935,
  multiball: 0xab47bc,
  sticky: 0x26a69a,
  fireball: 0xff7043,
  extraLife: 0xec407a,
  laser: 0xff1744,
  laserBeam: 0xff5252,
  fireTint: 0xff6d00,
  ui: 0xffffff,
  title: 0x4fc3f7,
} as const;

export const HIGH_SCORE_KEY = 'orc-ball-highscore';
export const SOUND_MUTED_KEY = 'orc-ball-sound-muted';

export const SCORE_PER_HIT = 10;
export const SCORE_PER_BREAK = 50;
export const SCORE_PER_X_BREAK = 100;
