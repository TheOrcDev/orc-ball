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
  LASER_COOLDOWN_MS,
  MAX_BALL_SPEED,
  MULTIBALL_CAP,
  PADDLE_HIT_COOLDOWN_MS,
  PADDLE_Y,
  PADDLE_Y_TOUCH,
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
  clonesForSource,
  multiballCloneAngles,
  multiballSpawnSlots,
  shouldLoseLife,
  velocityAngleDeg,
} from '../logic/multiball';
import { laserMuzzleXs } from '../logic/powerUpState';
import { velocityFromAngle } from '../logic/steering';
import { isTapGesture, prefersTouchUi } from '../logic/touch';
import { Ball } from '../objects/Ball';
import { Brick } from '../objects/Brick';
import { Laser } from '../objects/Laser';
import { Paddle } from '../objects/Paddle';
import { PowerUp, POWERUP_LABEL } from '../objects/PowerUp';
import { BoardFx } from '../systems/BoardFx';
import { Music } from '../systems/Music';
import {
  clearRunKeepUnlocks,
  loadProgress,
  saveGameOver,
  saveLevelCleared,
  saveRun,
  updateHighScore,
} from '../systems/ProgressSave';
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
  private lasers!: Phaser.Physics.Arcade.Group;
  private powerUpManager!: PowerUpManager;
  private sfx!: Sfx;
  private lastLaserShotAt = 0;
  private breakEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fireTrailEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private pauseKey?: Phaser.Input.Keyboard.Key;
  private escKey?: Phaser.Input.Keyboard.Key;
  private levelIndex = 0;
  private destructibleRemaining = 0;
  private ballSpeed = DEFAULT_BALL_SPEED;
  private pausedForOverlay = false;
  private awaitingAdvance = false;
  private gameOverFlag = false;
  /** ESC / P pause menu — separate from level/game-over overlays. */
  private isPaused = false;
  private pauseOverlay?: Phaser.GameObjects.Container;
  private soundMenuLabel?: Phaser.GameObjects.Text;
  private musicMenuLabel?: Phaser.GameObjects.Text;
  private musicVolLabel?: Phaser.GameObjects.Text;
  /** Touch / small-screen chrome (LAUNCH button + hints). */
  private touchUi = false;
  private launchBtn?: Phaser.GameObjects.Container;
  private touchHint?: Phaser.GameObjects.Text;
  private pointerDownAt = 0;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private pointerDragging = false;
  /** Relative drag: paddle.x = pointer.x + dragOffsetX (finger can sit below paddle). */
  private dragOffsetX = 0;
  private ignoreNextPointerUp = false;
  private boardFx!: BoardFx;

  constructor() {
    super('GameScene');
  }

  init(data: GameSceneData): void {
    this.levelIndex = data.level ?? (this.registry.get('level') as number) ?? 0;
    this.pausedForOverlay = false;
    this.awaitingAdvance = false;
    this.gameOverFlag = false;
    this.isPaused = false;
    this.pauseOverlay = undefined;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.physics.world.setBounds(0, 0, WIDTH, HEIGHT);
    // Open bottom: left, right, top closed; bottom open
    this.physics.world.setBoundsCollision(true, true, true, false);

    this.input.keyboard?.addCapture('SPACE,LEFT,RIGHT,A,D,P,ESC');
    this.spaceKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
    this.pauseKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.P,
    );
    this.escKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC,
    );

    // Ensure registry defaults
    if (this.registry.get('score') === undefined) this.registry.set('score', 0);
    if (this.registry.get('lives') === undefined)
      this.registry.set('lives', START_LIVES);
    this.registry.set('level', this.levelIndex);
    this.registry.set('uiOverlay', 'none');

    this.sfx = new Sfx(this);
    this.sfx.tryUnlock();
    // Fresh soundtrack for this level (rotates tracks by level index)
    Music.playForLevel(this, this.levelIndex);

    this.boardFx = new BoardFx(this);

    this.touchUi = prefersTouchUi();
    // Raise paddle on touch so the finger rest zone is under the board
    const paddleY = this.touchUi ? PADDLE_Y_TOUCH : PADDLE_Y;
    this.paddle = new Paddle(this, undefined, paddleY);
    this.paddle.setDepth(10);
    this.setupPointerControls();
    if (this.touchUi) this.createTouchChrome();
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

    this.registry.set('effectGlue', false);
    this.registry.set('effectBullet', false);
    this.registry.set('effectLaser', false);

    this.lasers = this.physics.add.group({
      classType: Laser,
      runChildUpdate: false,
      maxSize: 24,
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
        onStickyExpired: () => this.launchStuckBalls(),
        onEffectsChanged: (effects) => {
          this.registry.set('effectGlue', effects.sticky);
          this.registry.set('effectBullet', effects.fireball);
          this.registry.set('effectLaser', effects.laser);
          this.boardFx.setEffects(effects, this.time.now);
        },
        onMultiballVisual: () => {
          this.boardFx.pulseMulti(this.time.now);
        },
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
      speed: { min: 20, max: 70 },
      lifespan: 280,
      scale: { start: 0.9, end: 0 },
      tint: [COLORS.fireTint, 0xffab40, 0xff3d00],
      frequency: 24,
      quantity: 2,
      blendMode: 'ADD',
      follow: undefined,
      emitting: false,
    });
    this.breakEmitter.setDepth(20);
    this.fireTrailEmitter.setDepth(15);

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
    this.physics.add.overlap(
      this.lasers,
      this.bricks,
      this.onLaserBrick as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
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
      Music.stop(this);
      this.powerUpManager.destroy();
      this.boardFx.destroy();
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
      brick.setup(b.kind, b.hp === Infinity ? 99 : b.hp, b.row);
      this.bricks.add(brick);
      // Static body needs refresh after add
      brick.refreshBody();
    }
  }

  private serveBall(): void {
    this.balls.clear(true, true);
    const top = this.paddle.faceTop;
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

  private setupPointerControls(): void {
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.events.on('shutdown', () => {
      this.input.off('pointerdown', this.onPointerDown, this);
      this.input.off('pointermove', this.onPointerMove, this);
      this.input.off('pointerup', this.onPointerUp, this);
    });
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.pausedForOverlay) {
      this.handleOverlaySpace();
      return;
    }
    if (this.isPaused) return;
    // Launch button handles its own press
    if (this.isPointerOnLaunchBtn(pointer)) return;

    this.pointerDownAt = this.time.now;
    this.pointerDownX = pointer.x;
    this.pointerDownY = pointer.y;
    this.pointerDragging = false;
    // Keep finger free of the paddle: follow X with the grab offset
    this.dragOffsetX = this.paddle.x - pointer.x;
    this.paddle.setPointerTargetX(pointer.x + this.dragOffsetX);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown || this.pausedForOverlay || this.isPaused) return;
    if (this.isPointerOnLaunchBtn(pointer) && !this.paddle.hasPointerTarget) {
      return;
    }
    if (
      Math.hypot(pointer.x - this.pointerDownX, pointer.y - this.pointerDownY) >
      12
    ) {
      this.pointerDragging = true;
    }
    this.paddle.setPointerTargetX(pointer.x + this.dragOffsetX);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.ignoreNextPointerUp) {
      this.ignoreNextPointerUp = false;
      this.paddle.setPointerTargetX(null);
      return;
    }
    if (this.pausedForOverlay || this.isPaused) {
      this.paddle.setPointerTargetX(null);
      return;
    }

    const wasDrag = this.pointerDragging;
    this.paddle.setPointerTargetX(null);

    if (this.isPointerOnLaunchBtn(pointer)) return;

    const duration = this.time.now - this.pointerDownAt;
    if (
      !wasDrag &&
      isTapGesture(
        this.pointerDownX,
        this.pointerDownY,
        pointer.x,
        pointer.y,
        duration,
      )
    ) {
      this.handleSpaceAction();
    }
  }

  private isPointerOnLaunchBtn(pointer: Phaser.Input.Pointer): boolean {
    if (!this.launchBtn) return false;
    const b = this.launchBtn.getBounds();
    return b.contains(pointer.x, pointer.y);
  }

  private createTouchChrome(): void {
    // LAUNCH stays top-right of the finger zone so drag area stays free
    const bx = WIDTH - 72;
    const by = HEIGHT - 36;
    const bg = this.add
      .rectangle(0, 0, 100, 44, 0x4fc3f7, 0.92)
      .setStrokeStyle(2, 0xffffff, 0.85)
      .setOrigin(0.5);
    const label = this.add
      .text(0, 0, 'LAUNCH', {
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#0a0a12',
      })
      .setOrigin(0.5);

    this.launchBtn = this.add.container(bx, by, [bg, label]);
    this.launchBtn.setDepth(1000);
    this.launchBtn.setScrollFactor(0);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
      this.ignoreNextPointerUp = true;
      this.paddle.setPointerTargetX(null);
      this.handleSpaceAction();
      this.tweens.add({
        targets: this.launchBtn,
        scaleX: 0.92,
        scaleY: 0.92,
        duration: 60,
        yoyo: true,
      });
    });

    // Hint in the finger zone under the raised paddle
    this.touchHint = this.add
      .text(
        WIDTH / 2,
        HEIGHT - 12,
        'Drag below paddle to move  ·  Tap / LAUNCH to serve',
        {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#78909c',
        },
      )
      .setOrigin(0.5, 1)
      .setDepth(1000)
      .setScrollFactor(0);

    this.time.delayedCall(6000, () => {
      if (this.touchHint?.active) {
        this.tweens.add({
          targets: this.touchHint,
          alpha: 0.3,
          duration: 600,
        });
      }
    });
  }

  private togglePause(): void {
    // Don't fight level-complete / game-over interstitials
    if (this.pausedForOverlay || this.gameOverFlag || this.awaitingAdvance) {
      return;
    }
    if (this.isPaused) this.resumeGame();
    else this.pauseGame();
  }

  private pauseGame(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.physics.world.pause();
    this.time.paused = true;
    this.paddle.setPointerTargetX(null);
    Music.pause(this);
    this.showPauseMenu();
  }

  private resumeGame(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.physics.world.resume();
    this.time.paused = false;
    this.clearPauseMenu();
    Music.resume(this);
  }

  /**
   * In-game pause menu (ESC / P) — not the title landing screen.
   * Resume, new game, SFX, music on/off + volume %, main menu.
   */
  private showPauseMenu(): void {
    this.clearPauseMenu();
    const container = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(2000);

    const dim = this.add
      .rectangle(0, 0, WIDTH + 4, HEIGHT + 4, 0x000000, 0.55)
      .setInteractive();

    const panel = this.add
      .rectangle(0, 0, 340, 400, 0x0a0a14, 0.94)
      .setStrokeStyle(2, COLORS.title);

    const title = this.add
      .text(0, -168, 'PAUSED', {
        fontFamily: 'monospace',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#4fc3f7',
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(0, 178, 'ESC / P to resume', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#78909c',
      })
      .setOrigin(0.5);

    container.add([dim, panel, title, hint]);

    // Resume
    {
      const btn = this.makePauseButton('Resume', -118, () => this.resumeGame());
      container.add([btn.bg, btn.text]);
    }
    // New Game
    {
      const btn = this.makePauseButton('New Game', -68, () =>
        this.startNewGame(),
      );
      container.add([btn.bg, btn.text]);
    }
    // SFX
    {
      const btn = this.makePauseButton(
        Sfx.isMuted ? 'SFX: OFF' : 'SFX: ON',
        -18,
        () => {
          Sfx.toggleMuted();
          this.soundMenuLabel?.setText(Sfx.isMuted ? 'SFX: OFF' : 'SFX: ON');
          if (!Sfx.isMuted) this.sfx.tryUnlock();
          this.sfx.paddleHit();
        },
      );
      this.soundMenuLabel = btn.text;
      container.add([btn.bg, btn.text]);
    }
    // Music on/off
    {
      const btn = this.makePauseButton(
        Music.isEnabled ? 'Music: ON' : 'Music: OFF',
        32,
        () => {
          Music.toggleEnabled(this);
          Music.syncPlaying(this);
          this.musicMenuLabel?.setText(
            Music.isEnabled ? 'Music: ON' : 'Music: OFF',
          );
          this.sfx.paddleHit();
        },
      );
      this.musicMenuLabel = btn.text;
      container.add([btn.bg, btn.text]);
    }
    // Music volume %  (−  Vol xx%  +)
    {
      const y = 82;
      const rowBg = this.add
        .rectangle(0, y, 240, 40, 0x1a2332, 1)
        .setStrokeStyle(1, 0x4fc3f7, 0.5);
      container.add(rowBg);

      const minus = this.add
        .text(-90, y, '−', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      this.musicVolLabel = this.add
        .text(0, y, `Vol ${Music.volumePercent}%`, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#ffd54f',
        })
        .setOrigin(0.5);
      const plus = this.add
        .text(90, y, '+', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      const bump = (delta: number) => {
        Music.adjustVolume(delta, this);
        Music.syncPlaying(this);
        this.musicVolLabel?.setText(`Vol ${Music.volumePercent}%`);
        this.sfx.paddleHit();
      };
      minus.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event?.stopPropagation?.();
        this.ignoreNextPointerUp = true;
        bump(-10);
      });
      plus.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event?.stopPropagation?.();
        this.ignoreNextPointerUp = true;
        bump(10);
      });
      minus.on('pointerover', () => minus.setColor('#4fc3f7'));
      minus.on('pointerout', () => minus.setColor('#ffffff'));
      plus.on('pointerover', () => plus.setColor('#4fc3f7'));
      plus.on('pointerout', () => plus.setColor('#ffffff'));

      container.add([minus, this.musicVolLabel, plus]);
    }
    // Main Menu
    {
      const btn = this.makePauseButton('Main Menu', 132, () =>
        this.goToMainMenu(),
      );
      container.add([btn.bg, btn.text]);
    }

    this.pauseOverlay = container;
  }

  private makePauseButton(
    label: string,
    y: number,
    onClick: () => void,
  ): { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } {
    const bg = this.add
      .rectangle(0, y, 240, 40, 0x1a2332, 1)
      .setStrokeStyle(1, 0x4fc3f7, 0.5)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(0, y, label, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(0x263348, 1);
      text.setColor('#4fc3f7');
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x1a2332, 1);
      text.setColor('#ffffff');
    });
    bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
      this.ignoreNextPointerUp = true;
      onClick();
    });

    return { bg, text };
  }

  private clearPauseMenu(): void {
    this.pauseOverlay?.destroy(true);
    this.pauseOverlay = undefined;
    this.soundMenuLabel = undefined;
    this.musicMenuLabel = undefined;
    this.musicVolLabel = undefined;
  }

  private startNewGame(): void {
    this.clearPauseMenu();
    this.isPaused = false;
    this.physics.world.resume();
    this.time.paused = false;
    Music.stop(this);
    clearRunKeepUnlocks();
    this.registry.set('score', 0);
    this.registry.set('lives', START_LIVES);
    this.registry.set('level', 0);
    this.registry.set('highScore', loadProgress().highScore);
    this.registry.set('uiOverlay', 'none');
    this.registry.set('effectGlue', false);
    this.registry.set('effectBullet', false);
    this.registry.set('effectLaser', false);
    this.scene.restart({ level: 0 });
  }

  private goToMainMenu(): void {
    // Checkpoint so Continue works from title
    const score = (this.registry.get('score') as number) ?? 0;
    const lives = (this.registry.get('lives') as number) ?? START_LIVES;
    if (lives > 0 && !this.gameOverFlag) {
      saveRun(this.levelIndex, score, lives);
      this.registry.set('highScore', loadProgress().highScore);
    }
    Music.stop(this);
    this.clearPauseMenu();
    this.isPaused = false;
    this.physics.world.resume();
    this.time.paused = false;
    this.registry.set('uiOverlay', 'none');
    this.scene.stop('UIScene');
    this.scene.start('MenuScene');
  }

  private launchStuckBalls(): void {
    if (this.isPaused || this.pausedForOverlay) return;
    const stuck = (this.balls.getChildren() as Ball[]).filter(
      (b) => b.active && b.stuckToPaddle,
    );
    if (stuck.length === 0) return;
    const paddleVx = this.paddle.getHorizontalVelocity();
    for (const ball of stuck) {
      ball.launchFromPaddle(
        this.paddle.x,
        this.paddle.displayWidth,
        paddleVx,
      );
      this.sfx.paddleHit();
    }
  }

  /**
   * SPACE while LASER is active and no stuck balls: twin beams from
   * left/right paddle ends.
   */
  private tryShootLasers(): boolean {
    if (this.isPaused || this.pausedForOverlay) return false;
    if (!this.powerUpManager.isLaser) return false;
    const stuck = (this.balls.getChildren() as Ball[]).some(
      (b) => b.active && b.stuckToPaddle,
    );
    if (stuck) return false;

    const now = this.time.now;
    if (now - this.lastLaserShotAt < LASER_COOLDOWN_MS) return false;
    this.lastLaserShotAt = now;

    const { left, right } = laserMuzzleXs(
      this.paddle.x,
      this.paddle.displayWidth,
    );
    const y = this.paddle.faceTop;
    this.spawnLaser(left, y);
    this.spawnLaser(right, y);
    this.sfx.paddleHit();
    return true;
  }

  private spawnLaser(x: number, y: number): void {
    // Spawn slightly above paddle face so bolts clear the cannons
    const laser = new Laser(this, x, y - 8);
    this.lasers.add(laser);
    // Velocity MUST be set after group.add — Phaser groups reset body state
    laser.arm();
  }

  private onLaserBrick: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
    obj1,
    obj2,
  ) => {
    const pair = resolvePair(
      obj1,
      obj2,
      (o): o is Laser => o instanceof Laser,
      (o): o is Brick => o instanceof Brick,
    );
    if (!pair) return;
    const { a: laser, b: brick } = pair;
    if (!laser.active || !brick.active) return;

    // Lasers damage HP bricks; bounce off / ignore indestructible
    if (brick.isIndestructible) {
      laser.destroy();
      this.sfx.brickHit(3);
      return;
    }

    laser.destroy();
    const color = brick.tintColor;
    const result = brick.takeHit(false);
    if (result.damaged && !result.destroyed) {
      this.sfx.brickHit(brick.hp);
      this.addScore(SCORE_PER_HIT);
    }
    if (result.destroyed) {
      this.destructibleRemaining = Math.max(0, this.destructibleRemaining - 1);
      this.addScore(SCORE_PER_BREAK);
      this.sfx.brickBreak();
      this.breakEmitter.setParticleTint(color);
      this.breakEmitter.explode(8, brick.x, brick.y);
      this.boardFx.crackleAt(brick.x, brick.y);
      this.maybeDropPowerUp(brick.x, brick.y);
      brick.destroy();
      if (this.destructibleRemaining <= 0) {
        this.onLevelClear();
      }
    }
  };

  /** SPACE: launch stuck balls, else fire lasers if equipped. */
  private handleSpaceAction(): void {
    if (this.isPaused || this.pausedForOverlay) return;
    const hadStuck = (this.balls.getChildren() as Ball[]).some(
      (b) => b.active && b.stuckToPaddle,
    );
    if (hadStuck) {
      this.launchStuckBalls();
      return;
    }
    this.tryShootLasers();
  }

  /**
   * Phaser group-vs-sprite colliders invoke callbacks as (sprite, groupChild),
   * so collider(balls, paddle) arrives as (paddle, ball) — resolve by type.
   *
   * Bounce uses hit position on the paddle (DX-Ball): far left → sharp left
   * angle, center → straight up, far right → sharp right. Arcade reflection
   * is overwritten so side hits always go that direction.
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

    const now = this.time.now;
    // Cooldown only — do NOT skip when vy < 0 (arcade bounce flips vy first
    // and that used to cancel our position-based steering entirely).
    if (now - ball.lastPaddleHitAt < PADDLE_HIT_COOLDOWN_MS) return;

    const body = ball.body as Phaser.Physics.Arcade.Body | null;
    const paddleBody = paddle.body as Phaser.Physics.Arcade.Body;
    const paddleTop = paddle.faceTop;

    // GLUE (sticky): ball sticks until SPACE — no auto-bounce
    if (this.powerUpManager.isSticky || paddle.sticky) {
      const offset = ball.x - paddle.x;
      ball.stickTo(paddle.x, paddleTop, offset, now);
      ball.lastPaddleHitAt = now;
      return;
    }

    // Seat ball on top of paddle, then set steered velocity from hit offset
    ball.y = paddleTop - BALL_RADIUS - 1;
    if (body) {
      body.y = ball.y - body.halfHeight;
    }
    ball.applyPaddleHit(
      paddle.x,
      paddle.displayWidth,
      this.paddle.getHorizontalVelocity() || paddleBody.velocity.x,
      now,
    );
    this.sfx.paddleHit();
    this.boardFx.crackleAt(ball.x, ball.y);
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
      this.boardFx.crackleAt(brick.x, brick.y);
      this.cameras.main.shake(100, 0.004);

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
      const label = POWERUP_LABEL[type];
      this.powerUpManager.collect(type);
      this.showPowerUpToast(label, power.x, power.y);
      power.destroy();
    };

  /** Floating label when a power-up is collected (GLUE / BULLET / …). */
  private showPowerUpToast(label: string, x: number, y: number): void {
    const t = this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '18px',
        fontStyle: 'bold',
        color: label === 'GLUE' ? '#26a69a' : label === 'BULLET' ? '#ff7043' : '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /**
   * MULTIBALL: every existing ball is multiplied (up to 2 clones each),
   * not just the first — re-collecting multi multiplies the whole swarm.
   * Respects MULTIBALL_CAP (12).
   */
  private spawnMultiball(): void {
    // Snapshot sources so we don't multiply newly spawned clones in this pass
    const sources = (this.balls.getChildren() as Ball[]).filter(
      (b) => b.active,
    );
    if (sources.length === 0) return;

    for (const source of sources) {
      const slots = multiballSpawnSlots(this.balls.countActive(true));
      if (slots <= 0) break;

      const cloneCount = clonesForSource(slots, 2);
      if (cloneCount <= 0) break;

      let baseAngle: number;
      if (source.stuckToPaddle) {
        // Stuck serve: fan clones upward from paddle
        baseAngle = -90;
      } else {
        const body = source.body as Phaser.Physics.Arcade.Body;
        baseAngle = velocityAngleDeg(body.velocity.x, body.velocity.y);
      }

      const angles = multiballCloneAngles(baseAngle, cloneCount);
      for (const a of angles) {
        if (this.balls.countActive(true) >= MULTIBALL_CAP) return;
        const { vx, vy } = velocityFromAngle(a, source.speed);
        const nb = this.createBall(source.x, source.y);
        nb.speed = source.speed;
        nb.launchWithVelocity(vx, vy);
        this.powerUpManager.decorateNewBall(nb);
      }
    }
  }

  private addScore(n: number): void {
    const score = ((this.registry.get('score') as number) ?? 0) + n;
    this.registry.set('score', score);
    // Lightweight high-score track (full run checkpoint on level clear / menu)
    if (score % 100 === 0) {
      updateHighScore(score);
    }
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

    const score = (this.registry.get('score') as number) ?? 0;
    const lives = (this.registry.get('lives') as number) ?? START_LIVES;
    saveLevelCleared(this.levelIndex, score, lives);
    this.registry.set('highScore', loadProgress().highScore);

    // Level-clear sting; next level restarts scene → playForLevel picks new track
    Music.playLevelClear(this);

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

    // Checkpoint after each life loss so refresh can continue
    const score = (this.registry.get('score') as number) ?? 0;
    saveRun(this.levelIndex, score, lives);
    this.serveBall();
  }

  private onGameOver(): void {
    this.gameOverFlag = true;
    this.pausedForOverlay = true;
    this.sfx.gameOver();
    const score = (this.registry.get('score') as number) ?? 0;
    saveGameOver(score, this.levelIndex);
    this.registry.set('highScore', loadProgress().highScore);
    this.registry.set('uiOverlay', 'gameOver');
  }

  update(time: number, delta: number): void {
    // ESC or P opens/closes the pause menu (except win/lose overlays)
    const escPressed =
      this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey);
    const pPressed =
      this.pauseKey && Phaser.Input.Keyboard.JustDown(this.pauseKey);
    if (escPressed || pPressed) {
      this.togglePause();
    }

    if (this.isPaused) {
      // Physics/time frozen; pause menu interactive
      return;
    }

    this.boardFx.update(time, delta);

    if (this.pausedForOverlay) {
      if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.handleOverlaySpace();
      }
      // Touch: pointerdown already advances overlay
      return;
    }

    this.paddle.update(time, delta);

    // Stuck balls follow paddle. Auto-launch only when NOT under GLUE
    // (glue requires SPACE / LAUNCH). Initial serve auto-launches after timeout.
    const stuck = (this.balls.getChildren() as Ball[]).filter(
      (b) => b.active && b.stuckToPaddle,
    );
    const glueActive = this.powerUpManager.isSticky;
    for (const ball of stuck) {
      ball.followPaddle(this.paddle.x, this.paddle.faceTop);
      if (
        !glueActive &&
        time - ball.stuckSince >= STUCK_AUTO_LAUNCH_MS
      ) {
        this.launchStuckBalls();
        break;
      }
    }

    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.handleSpaceAction();
    }

    // Pulse LAUNCH when a ball is waiting or lasers are armed
    if (this.launchBtn) {
      const waiting = stuck.length > 0 || this.powerUpManager.isLaser;
      this.launchBtn.setAlpha(waiting ? 1 : 0.55);
    }

    // Cull lasers past top of screen
    for (const laser of this.lasers.getChildren() as Laser[]) {
      if (laser.active && laser.y < -20) laser.destroy();
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

    // Sync drop letters + cull fallen power-ups
    for (const pu of this.powerUps.getChildren() as PowerUp[]) {
      if (!pu.active) continue;
      pu.syncLabel();
      if (pu.y > HEIGHT + 40) pu.destroy();
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
