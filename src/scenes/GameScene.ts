import Phaser from 'phaser';
import {
  BALL_RADIUS,
  BALL_SPEED_RAMP,
  BRICK_GAP,
  BRICK_GRID_TOP,
  BRICK_HEIGHT,
  BRICK_WIDTH,
  COLORS,
  DEFAULT_BALL_SPEED,
  HEIGHT,
  MAX_BALL_SPEED,
  MULTIBALL_CAP,
  SCORE_PER_BREAK,
  SCORE_PER_HIT,
  SCORE_PER_X_BREAK,
  START_LIVES,
  STUCK_AUTO_LAUNCH_MS,
  WIDTH,
} from '../config';
import { getLevel, levelCount, LEVELS } from '../data/levels';
import type { PowerUpType } from '../data/types';
import { rollPowerUpDrop } from '../logic/drops';
import { resolvePair } from '../logic/collidePair';
import {
  canDamageBrick,
  shouldProcessBallBrickCollision,
} from '../logic/fireball';
import { parseLevel } from '../logic/levelParse';
import {
  multiballCloneAngles,
  multiballSpawnSlots,
  shouldLoseLife,
  velocityAngleDeg,
} from '../logic/multiball';
import { velocityFromAngle } from '../logic/steering';
import { Ball } from '../objects/Ball';
import { Brick } from '../objects/Brick';
import { Paddle } from '../objects/Paddle';
import { PowerUp } from '../objects/PowerUp';
import { PowerUpManager } from '../systems/PowerUpManager';
import { Sfx } from '../systems/Sfx';

interface GameSceneData {
  level?: number;
}

export class GameScene extends Phaser.Scene {
  private paddle!: Paddle;
  private balls!: Phaser.Physics.Arcade.Group;
  private bricks!: Phaser.Physics.Arcade.StaticGroup;
  private powerUps!: Phaser.Physics.Arcade.Group;
  private powerUpManager!: PowerUpManager;
  private sfx!: Sfx;
  private breakEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireTrailEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private levelIndex = 0;
  private destructibleRemaining = 0;
  private ballSpeed = DEFAULT_BALL_SPEED;
  private pausedForOverlay = false;
  private awaitingAdvance = false;
  private gameOverFlag = false;

  constructor() {
    super('GameScene');
  }

  init(data: GameSceneData): void {
    this.levelIndex = data.level ?? (this.registry.get('level') as number) ?? 0;
    this.pausedForOverlay = false;
    this.awaitingAdvance = false;
    this.gameOverFlag = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.physics.world.setBounds(0, 0, WIDTH, HEIGHT);
    // Open bottom: left, right, top closed; bottom open
    this.physics.world.setBoundsCollision(true, true, true, false);

    this.input.keyboard?.addCapture('SPACE,LEFT,RIGHT,A,D');
    this.spaceKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );

    // Ensure registry defaults
    if (this.registry.get('score') === undefined) this.registry.set('score', 0);
    if (this.registry.get('lives') === undefined)
      this.registry.set('lives', START_LIVES);
    this.registry.set('level', this.levelIndex);
    this.registry.set('uiOverlay', 'none');

    this.sfx = new Sfx(this);
    this.sfx.tryUnlock();

    this.paddle = new Paddle(this);
    this.balls = this.physics.add.group({
      classType: Ball,
      runChildUpdate: false,
      maxSize: MULTIBALL_CAP,
    });
    this.bricks = this.physics.add.staticGroup();
    this.powerUps = this.physics.add.group({
      classType: PowerUp,
      runChildUpdate: false,
    });

    this.powerUpManager = new PowerUpManager(
      this,
      this.paddle,
      () => this.balls.getChildren() as Ball[],
      (this.registry.get('lives') as number) ?? START_LIVES,
      {
        onMultiball: () => this.spawnMultiball(),
        onLivesChanged: (lives) => this.registry.set('lives', lives),
        onExtraLife: () => this.sfx.powerUp(),
        onBonus: () => this.sfx.powerUp(),
        onMalus: () => this.sfx.powerDown(),
      },
    );

    // Particles
    this.breakEmitter = this.add.particles(0, 0, 'particle', {
      speed: { min: 60, max: 180 },
      angle: { min: 0, max: 360 },
      lifespan: 400,
      scale: { start: 1, end: 0 },
      quantity: 12,
      emitting: false,
    });

    this.fireTrailEmitter = this.add.particles(0, 0, 'particle', {
      speed: { min: 10, max: 40 },
      lifespan: 200,
      scale: { start: 0.6, end: 0 },
      tint: COLORS.fireTint,
      frequency: 40,
      follow: undefined,
      emitting: false,
    });

    // Colliders — group-based for multi-ball
    this.physics.add.collider(
      this.balls,
      this.paddle,
      this.onBallPaddle as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );
    this.physics.add.collider(
      this.balls,
      this.bricks,
      this.onBallBrick as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      this.processBallBrick as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      this,
    );
    this.physics.add.overlap(
      this.powerUps,
      this.paddle,
      this.onCollectPowerUp as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Wall hit SFX via world bounds on balls
    this.physics.world.on(
      'worldbounds',
      (body: Phaser.Physics.Arcade.Body) => {
        const go = body.gameObject;
        if (go instanceof Ball && !go.stuckToPaddle) {
          this.sfx.wallHit();
        }
      },
    );

    this.buildLevel(this.levelIndex);
    this.serveBall();

    // Launch UIScene in parallel
    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    } else {
      // Refresh UI
      this.registry.set('score', this.registry.get('score'));
    }

    this.events.on('shutdown', () => {
      this.powerUpManager.destroy();
    });
  }

  private buildLevel(index: number): void {
    const def = getLevel(index) ?? LEVELS[0]!;
    this.ballSpeed = def.ballSpeed;
    this.registry.set('level', index);

    // Clear old bricks
    this.bricks.clear(true, true);

    const { bricks, destructible } = parseLevel(def);
    this.destructibleRemaining = destructible;

    // Center grid
    const cols = Math.max(...def.rows.map((r) => r.length), 1);
    const gridW = cols * (BRICK_WIDTH + BRICK_GAP) - BRICK_GAP;
    const startX = (WIDTH - gridW) / 2 + BRICK_WIDTH / 2;
    const startY = BRICK_GRID_TOP + BRICK_HEIGHT / 2;

    for (const b of bricks) {
      const x = startX + b.col * (BRICK_WIDTH + BRICK_GAP);
      const y = startY + b.row * (BRICK_HEIGHT + BRICK_GAP);
      const brick = new Brick(this, x, y);
      brick.setup(b.kind, b.hp === Infinity ? 99 : b.hp);
      this.bricks.add(brick);
      // Static body needs refresh after add
      brick.refreshBody();
    }
  }

  private serveBall(): void {
    this.balls.clear(true, true);
    const top = this.paddle.y - this.paddle.displayHeight / 2;
    const ball = this.createBall(this.paddle.x, top - BALL_RADIUS - 1);
    ball.speed = this.ballSpeed;
    ball.stickTo(this.paddle.x, top, 0, this.time.now);
    this.powerUpManager.decorateNewBall(ball);
  }

  private createBall(x: number, y: number): Ball {
    const ball = new Ball(this, x, y);
    this.balls.add(ball);
    const body = ball.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.onWorldBounds = true;
    // Re-apply open bottom for this body
    body.setBounce(1, 1);
    return ball;
  }

  private launchStuckBalls(): void {
    const stuck = (this.balls.getChildren() as Ball[]).filter(
      (b) => b.active && b.stuckToPaddle,
    );
    for (const ball of stuck) {
      ball.launchFromPaddle(this.paddle.x, this.paddle.displayWidth);
      this.sfx.paddleHit();
    }
  }

  /**
   * Phaser group-vs-sprite colliders invoke callbacks as (sprite, groupChild),
   * so collider(balls, paddle) arrives as (paddle, ball) — resolve by type.
   */
  private onBallPaddle: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
    obj1,
    obj2,
  ) => {
    const pair = resolvePair(
      obj1,
      obj2,
      (o): o is Ball => o instanceof Ball,
      (o): o is Paddle => o instanceof Paddle,
    );
    if (!pair) return;
    const { a: ball, b: paddle } = pair;
    if (!ball.active || ball.stuckToPaddle) return;

    const body = ball.body as Phaser.Physics.Arcade.Body | null;
    // Ignore re-hits while already rising (overlap residual after bounce)
    if (body && body.velocity.y < 0) return;

    const paddleTop = paddle.y - paddle.displayHeight / 2;

    if (this.powerUpManager.isSticky || paddle.sticky) {
      const offset = ball.x - paddle.x;
      ball.stickTo(paddle.x, paddleTop, offset, this.time.now);
      return;
    }

    // Seat ball on top of paddle then steer — prevents resting / re-embed
    ball.y = paddleTop - BALL_RADIUS - 1;
    if (body) {
      body.y = ball.y - body.halfHeight;
    }
    ball.applyPaddleHit(paddle.x, paddle.displayWidth);
    this.sfx.paddleHit();
  };

  /**
   * processCallback: return false for fireballs so they pass through after
   * we destroy the brick inline in this callback.
   */
  private processBallBrick: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback =
    (obj1, obj2) => {
      const pair = resolvePair(
        obj1,
        obj2,
        (o): o is Ball => o instanceof Ball,
        (o): o is Brick => o instanceof Brick,
      );
      if (!pair) return false;
      const { a: ball, b: brick } = pair;
      if (!ball.active || !brick.active) return false;

      if (ball.isFireball) {
        // Handle destroy inline, skip physical collision
        this.hitBrick(ball, brick, true);
        return shouldProcessBallBrickCollision(true); // false
      }
      return shouldProcessBallBrickCollision(false); // true
    };

  private onBallBrick: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
    obj1,
    obj2,
  ) => {
    const pair = resolvePair(
      obj1,
      obj2,
      (o): o is Ball => o instanceof Ball,
      (o): o is Brick => o instanceof Brick,
    );
    if (!pair) return;
    const { a: ball, b: brick } = pair;
    if (!ball.active || !brick.active) return;
    // Normal (non-fire) balls land here after processCallback returns true
    this.hitBrick(ball, brick, false);
  };

  private hitBrick(ball: Ball, brick: Brick, isFire: boolean): void {
    if (!canDamageBrick(isFire || ball.isFireball, brick.isIndestructible)) {
      // Indestructible + normal ball: just bounce (handled by collider)
      this.sfx.brickHit(3);
      return;
    }

    const color = brick.tintColor;
    const result = brick.takeHit(isFire || ball.isFireball);

    if (result.damaged && !result.destroyed) {
      this.sfx.brickHit(brick.hp);
      this.addScore(SCORE_PER_HIT);
    }

    if (result.destroyed) {
      const wasX = brick.brickType === 'indestructible';
      if (!wasX) {
        this.destructibleRemaining = Math.max(0, this.destructibleRemaining - 1);
        this.addScore(SCORE_PER_BREAK);
      } else {
        this.addScore(SCORE_PER_X_BREAK);
      }

      this.sfx.brickBreak();
      this.breakEmitter.setParticleTint(color);
      this.breakEmitter.explode(12, brick.x, brick.y);
      this.cameras.main.shake(100, 0.004);
      if (isFire || ball.isFireball) {
        this.cameras.main.flash(80, 255, 120, 40, false);
      }

      // Speed ramp
      this.ballSpeed = Math.min(MAX_BALL_SPEED, this.ballSpeed + BALL_SPEED_RAMP);
      for (const b of this.balls.getChildren() as Ball[]) {
        if (b.active && !b.stuckToPaddle) b.speed = this.ballSpeed;
      }

      this.maybeDropPowerUp(brick.x, brick.y);
      brick.destroy();

      if (this.destructibleRemaining <= 0) {
        this.onLevelClear();
      }
    }
  }

  private maybeDropPowerUp(x: number, y: number): void {
    const def = getLevel(this.levelIndex);
    if (!def) return;
    const type = rollPowerUpDrop(def.dropChance, def.dropTable);
    if (!type) return;
    const pu = new PowerUp(this, x, y, type);
    this.powerUps.add(pu);
    const body = pu.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 150);
  }

  private onCollectPowerUp: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback =
    (obj1, obj2) => {
      const power =
        obj1 instanceof PowerUp
          ? obj1
          : obj2 instanceof PowerUp
            ? obj2
            : null;
      if (!power || !power.active) return;
      const type = power.powerType as PowerUpType;
      this.powerUpManager.collect(type);
      power.destroy();
    };

  private spawnMultiball(): void {
    const active = (this.balls.getChildren() as Ball[]).filter(
      (b) => b.active && !b.stuckToPaddle,
    );
    const source =
      active[0] ??
      (this.balls.getChildren() as Ball[]).find((b) => b.active);
    if (!source) return;

    const slots = multiballSpawnSlots(this.balls.countActive(true));
    if (slots <= 0) return;

    const body = source.body as Phaser.Physics.Arcade.Body;
    const angle = velocityAngleDeg(body.velocity.x, body.velocity.y);
    const cloneCount = Math.min(2, slots);
    const angles = multiballCloneAngles(angle, cloneCount);

    for (const a of angles) {
      if (this.balls.countActive(true) >= MULTIBALL_CAP) break;
      const { vx, vy } = velocityFromAngle(a, source.speed);
      const nb = this.createBall(source.x, source.y);
      nb.speed = source.speed;
      nb.launchWithVelocity(vx, vy);
      this.powerUpManager.decorateNewBall(nb);
    }
  }

  private addScore(n: number): void {
    const score = ((this.registry.get('score') as number) ?? 0) + n;
    this.registry.set('score', score);
  }

  private onLevelClear(): void {
    if (this.awaitingAdvance) return;
    this.awaitingAdvance = true;
    this.pausedForOverlay = true;
    this.powerUpManager.reset();
    this.sfx.levelClear();

    // Freeze balls
    for (const b of this.balls.getChildren() as Ball[]) {
      if (b.body) {
        (b.body as Phaser.Physics.Arcade.Body).enable = false;
      }
    }
    this.powerUps.clear(true, true);

    const next = this.levelIndex + 1;
    if (next >= levelCount()) {
      this.registry.set('uiOverlay', 'victory');
      this.gameOverFlag = true; // reuse SPACE → menu
    } else {
      this.registry.set('uiOverlay', 'levelComplete');
    }
  }

  private onLifeLost(): void {
    this.sfx.loseLife();
    this.cameras.main.shake(250, 0.01);
    this.powerUpManager.reset();
    this.powerUps.clear(true, true);

    const lives = ((this.registry.get('lives') as number) ?? 1) - 1;
    this.registry.set('lives', lives);
    this.powerUpManager.setLives(lives);

    if (lives <= 0) {
      this.onGameOver();
      return;
    }

    this.serveBall();
  }

  private onGameOver(): void {
    this.gameOverFlag = true;
    this.pausedForOverlay = true;
    this.sfx.gameOver();
    this.registry.set('uiOverlay', 'gameOver');
  }

  update(time: number, delta: number): void {
    if (this.pausedForOverlay) {
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.handleOverlaySpace();
      }
      return;
    }

    this.paddle.update(time, delta);

    // Stuck balls follow paddle + auto-launch
    const stuck = (this.balls.getChildren() as Ball[]).filter(
      (b) => b.active && b.stuckToPaddle,
    );
    for (const ball of stuck) {
      ball.followPaddle(
        this.paddle.x,
        this.paddle.y - this.paddle.displayHeight / 2,
      );
      if (time - ball.stuckSince >= STUCK_AUTO_LAUNCH_MS) {
        ball.launchFromPaddle(this.paddle.x, this.paddle.displayWidth);
        this.sfx.paddleHit();
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.launchStuckBalls();
    }

    // Maintain constant speed + fire trail
    for (const ball of this.balls.getChildren() as Ball[]) {
      if (!ball.active) continue;
      ball.maintainSpeed();

      // Bottom death
      if (!ball.stuckToPaddle && ball.y > HEIGHT + 20) {
        ball.destroy();
      }
    }

    // Fire trail on fireballs
    if (this.fireTrailEmitter) {
      const fireBall = (this.balls.getChildren() as Ball[]).find(
        (b) => b.active && b.isFireball && !b.stuckToPaddle,
      );
      if (fireBall) {
        this.fireTrailEmitter.startFollow(fireBall);
        this.fireTrailEmitter.start();
      } else {
        this.fireTrailEmitter.stop();
        this.fireTrailEmitter.stopFollow();
      }
    }

    // Cull fallen power-ups
    for (const pu of this.powerUps.getChildren() as PowerUp[]) {
      if (pu.active && pu.y > HEIGHT + 40) pu.destroy();
    }

    // Life lost when no balls remain
    if (
      shouldLoseLife(this.balls.countActive(true)) &&
      !this.awaitingAdvance &&
      !this.gameOverFlag
    ) {
      this.onLifeLost();
    }
  }

  private handleOverlaySpace(): void {
    this.sfx.tryUnlock();
    const overlay = this.registry.get('uiOverlay') as string;

    if (overlay === 'levelComplete') {
      const next = this.levelIndex + 1;
      this.registry.set('uiOverlay', 'none');
      // Carry score/lives; restart with next level
      this.scene.restart({ level: next });
      return;
    }

    if (overlay === 'gameOver' || overlay === 'victory') {
      this.registry.set('uiOverlay', 'none');
      this.scene.stop('UIScene');
      this.scene.start('MenuScene');
    }
  }
}
