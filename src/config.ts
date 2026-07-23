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

export const BALL_RADIUS = 8;
export const BALL_DIAMETER = BALL_RADIUS * 2;
export const DEFAULT_BALL_SPEED = 280;
export const BALL_SPEED_RAMP = 8; // per brick break
export const MAX_BALL_SPEED = 420;
export const MIN_VELOCITY_COMPONENT = 40;
export const STEER_MAX_DEG = 60;
export const STUCK_AUTO_LAUNCH_MS = 3000;
export const MULTIBALL_CAP = 12;
export const MULTIBALL_SPREAD_DEG = 25;
export const MAX_LIVES = 9;
export const START_LIVES = 3;

export const BRICK_WIDTH = 64;
export const BRICK_HEIGHT = 32;
export const BRICK_GAP = 2;
export const BRICK_GRID_TOP = 80;

export const POWERUP_SIZE = 24;
export const POWERUP_FALL_SPEED = 150;
export const POWERUP_DURATION_MS = 10000;
export const DEFAULT_DROP_CHANCE = 0.2;

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
  fireTint: 0xff6d00,
  ui: 0xffffff,
  title: 0x4fc3f7,
} as const;

export const HIGH_SCORE_KEY = 'orc-ball-highscore';

export const SCORE_PER_HIT = 10;
export const SCORE_PER_BREAK = 50;
export const SCORE_PER_X_BREAK = 100;
