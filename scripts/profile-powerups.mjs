import { spawn } from 'node:child_process';
import process from 'node:process';
import { chromium } from 'playwright';

const ALL_POWER_UPS = [
  'EXPAND',
  'SHRINK',
  'MULTIBALL',
  'STICKY',
  'FIREBALL',
  'EXTRA_LIFE',
  'LASER',
  'SLOW',
  'EXPLODE',
];
const requestedPowerUps = (process.env.ORC_BALL_PROFILE_TYPES ?? '')
  .split(',')
  .map((type) => type.trim().toUpperCase())
  .filter(Boolean);
const POWER_UPS =
  requestedPowerUps.length === 0
    ? ALL_POWER_UPS
    : ALL_POWER_UPS.filter((type) => requestedPowerUps.includes(type));

if (POWER_UPS.length === 0) {
  throw new Error('ORC_BALL_PROFILE_TYPES did not match a known power-up');
}

const HOST = '127.0.0.1';
const PORT = Number(process.env.ORC_BALL_PROFILE_PORT ?? 4175);
const CPU_RATE = Number(process.env.ORC_BALL_CPU_RATE ?? 4);
const WARMUP_FRAMES = Number(process.env.ORC_BALL_WARMUP_FRAMES ?? 120);
const BASELINE_FRAMES = Number(process.env.ORC_BALL_BASELINE_FRAMES ?? 60);
const PROFILE_REPEATS = Number(process.env.ORC_BALL_PROFILE_REPEATS ?? 2);
const BASE_URL = `http://${HOST}:${PORT}`;
const cwd = process.cwd();
const serverOutput = [];

if (!Number.isInteger(PROFILE_REPEATS) || PROFILE_REPEATS < 1) {
  throw new Error('ORC_BALL_PROFILE_REPEATS must be a positive integer');
}

function rememberServerOutput(chunk) {
  serverOutput.push(chunk.toString());
  if (serverOutput.length > 30) serverOutput.shift();
}

async function waitForServer(timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Vite did not start within ${timeoutMs}ms.\n${serverOutput.join('')}`,
  );
}

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

async function waitForFrames(page, count) {
  await page.evaluate(async (frameCount) => {
    for (let frame = 0; frame < frameCount; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
}

function closeTo(actual, expected, tolerance = 0.01) {
  return Math.abs(actual - expected) <= tolerance;
}

function validatePowerUpState(result, failures) {
  const state = result.state;
  const fail = (message) => failures.push(`${result.type}: ${message}`);

  if (result.type === 'EXPAND') {
    if (!closeTo(state.paddleScale, 1.5)) fail('paddle did not expand');
    if (!closeTo(state.paddleBodyWidth, 180, 1)) {
      fail(`expanded body width was ${state.paddleBodyWidth}`);
    }
    if (state.theme !== 'expand') fail(`theme was ${state.theme}`);
  } else if (result.type === 'SHRINK') {
    if (!closeTo(state.paddleScale, 0.6)) fail('paddle did not shrink');
    if (!closeTo(state.paddleBodyWidth, 72, 1)) {
      fail(`shrunk body width was ${state.paddleBodyWidth}`);
    }
    if (state.theme !== 'shrink') fail(`theme was ${state.theme}`);
  } else if (result.type === 'MULTIBALL') {
    if (state.ballCount !== 3) fail(`spawned ${state.ballCount} balls`);
  } else if (result.type === 'STICKY') {
    if (!state.sticky || state.paddleTexture !== 'paddle-glue') {
      fail('glue state/texture was not active');
    }
    if (state.theme !== 'glue' || !state.effectSnapshot.glue) {
      fail('glue theme/HUD snapshot was not active');
    }
  } else if (result.type === 'FIREBALL') {
    if (!state.fireball || !state.allFireball) {
      fail('not every active ball became a fireball');
    }
    if (state.theme !== 'bullet' || !state.effectSnapshot.bullet) {
      fail('bullet theme/HUD snapshot was not active');
    }
  } else if (result.type === 'EXTRA_LIFE') {
    if (state.lives !== 4 || state.managerLives !== 4) {
      fail(`lives diverged (${state.lives}/${state.managerLives})`);
    }
    if (state.theme !== 'default') fail(`theme was ${state.theme}`);
  } else if (result.type === 'LASER') {
    if (!state.laser || !state.laserLook) fail('laser paddle was not active');
    if (state.theme !== 'laser' || !state.effectSnapshot.laser) {
      fail('laser theme/HUD snapshot was not active');
    }
  } else if (result.type === 'SLOW') {
    const expectedSpeed = state.baseBallSpeed * 0.55;
    if (
      !state.slow ||
      state.ballSpeeds.some((speed) => !closeTo(speed, expectedSpeed, 0.1))
    ) {
      fail('active ball speeds did not match the slow factor');
    }
    if (state.theme !== 'slow' || !state.effectSnapshot.slow) {
      fail('slow theme/HUD snapshot was not active');
    }
  } else if (result.type === 'EXPLODE') {
    if (!state.explode || !state.allExplosive) {
      fail('not every active ball became explosive');
    }
    if (state.theme !== 'explode' || !state.effectSnapshot.explode) {
      fail('blast theme/HUD snapshot was not active');
    }
  }
}

const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    '--host',
    HOST,
    '--port',
    String(PORT),
    '--strictPort',
  ],
  {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
server.stdout.on('data', rememberServerOutput);
server.stderr.on('data', rememberServerOutput);

let browser;

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });

  await page.addInitScript(() => {
    localStorage.setItem('orc-ball-sound-muted', '1');
    window.__ORC_BALL_PROFILE_METRICS__ = {
      rafGaps: [],
      longTasks: [],
      current: null,
      textWrapped: false,
    };

    let previousFrame = performance.now();
    const onFrame = (now) => {
      const metrics = window.__ORC_BALL_PROFILE_METRICS__;
      metrics.rafGaps.push({ at: now, duration: now - previousFrame });
      previousFrame = now;
      requestAnimationFrame(onFrame);
    };
    requestAnimationFrame(onFrame);

    if ('PerformanceObserver' in window) {
      try {
        new PerformanceObserver((list) => {
          const metrics = window.__ORC_BALL_PROFILE_METRICS__;
          for (const entry of list.getEntries()) {
            metrics.longTasks.push({
              at: entry.startTime,
              duration: entry.duration,
            });
          }
        }).observe({ type: 'longtask', buffered: true });
      } catch {
        // Long Task observation is optional; RAF gaps remain authoritative.
      }
    }
  });

  await page.goto(`${BASE_URL}/?profile=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await page.waitForFunction(
    () =>
      window.__ORC_BALL_GAME__?.textures?.exists('powerup-expand') === true,
    undefined,
    { timeout: 30_000 },
  );

  const results = [];

  for (const type of POWER_UPS) {
    for (let trial = 1; trial <= PROFILE_REPEATS; trial += 1) {
    if (results.length > 0) {
      await page.reload({
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await page.waitForFunction(
        () =>
          window.__ORC_BALL_GAME__?.textures?.exists('powerup-expand') === true,
        undefined,
        { timeout: 30_000 },
      );
    }

    await page.evaluate(async () => {
      const game = window.__ORC_BALL_GAME__;
      if (game.scene.isActive('UIScene')) game.scene.stop('UIScene');
      if (game.scene.isActive('GameScene')) game.scene.stop('GameScene');
      if (game.scene.isActive('MenuScene')) game.scene.stop('MenuScene');
      await new Promise((resolve) => requestAnimationFrame(resolve));
      game.registry.set('score', 0);
      game.registry.set('lives', 3);
      game.registry.set('highScore', 999_999);
      game.scene.start('GameScene', { level: 0 });
    });

    await page.waitForFunction(
      () => {
        const game = window.__ORC_BALL_GAME__;
        const scene = game?.scene?.getScene('GameScene');
        return (
          game?.scene?.isActive('GameScene') &&
          game?.scene?.isActive('UIScene') &&
          Boolean(scene?.powerUpManager && scene?.paddle && scene?.powerUps)
        );
      },
      undefined,
      { timeout: 10_000 },
    );
    // Let scene setup, texture uploads, and prior-scene disposal settle before
    // attributing a frame gap to a pickup.
    await waitForFrames(page, WARMUP_FRAMES);
    // Keep the sample deterministic: profiling lasts just under the normal
    // auto-launch delay, so serve a fresh stuck ball before the baseline.
    await page.evaluate(() => {
      window.__ORC_BALL_GAME__.scene.getScene('GameScene').serveBall();
    });
    await page.evaluate(() => {
      const root = window.__ORC_BALL_PROFILE_METRICS__;
      root.rafGaps.length = 0;
      root.longTasks.length = 0;
    });
    await waitForFrames(page, BASELINE_FRAMES);
    const baselineFrames = await page.evaluate(() =>
      window.__ORC_BALL_PROFILE_METRICS__.rafGaps.map(
        (entry) => entry.duration,
      ),
    );
    const baselineP95 = percentile(baselineFrames, 0.95);

    await page.evaluate(({ powerUpType, baselineP95Ms, trialNumber }) => {
      const game = window.__ORC_BALL_GAME__;
      const scene = game.scene.getScene('GameScene');
      const ui = game.scene.getScene('UIScene');
      const root = window.__ORC_BALL_PROFILE_METRICS__;
      const sample = {
        type: powerUpType,
        trial: trialNumber,
        baselineP95: baselineP95Ms,
        triggeredAt: 0,
        collected: 0,
        collectDurations: [],
        collectDuringPhysics: 0,
        bodyMutationsDuringPhysics: 0,
        boardFxDurations: [],
        effectTextUpdates: 0,
        effectTextDurations: [],
        effectColorUpdates: 0,
        toastTextUpdates: 0,
        effectRegistryEvents: [],
        events: [],
      };
      root.current = sample;
      game.registry.events.on('changedata', (_parent, key) => {
        if (key === 'effectSnapshot' || key.startsWith('effect')) {
          sample.effectRegistryEvents.push(key);
        }
      });

      if (!root.textWrapped) {
        const textPrototype = Object.getPrototypeOf(ui.scoreText);
        const originalUpdateText = textPrototype.updateText;
        const originalSetColor = textPrototype.setColor;
        textPrototype.updateText = function (...args) {
          const currentRoot = window.__ORC_BALL_PROFILE_METRICS__;
          const currentUi =
            window.__ORC_BALL_GAME__?.scene?.getScene('UIScene');
          const currentGame =
            window.__ORC_BALL_GAME__?.scene?.getScene('GameScene');
          const trackedEffect =
            currentRoot.current &&
            currentUi?.effectLineTexts?.includes(this);
          const trackedToast =
            currentRoot.current &&
            [...(currentGame?.powerUpToasts?.values() ?? [])].includes(this);
          const startedAt = performance.now();
          const result = originalUpdateText.apply(this, args);
          if (trackedEffect) {
            currentRoot.current.effectTextUpdates += 1;
            currentRoot.current.effectTextDurations.push(
              performance.now() - startedAt,
            );
          }
          if (trackedToast) currentRoot.current.toastTextUpdates += 1;
          return result;
        };
        textPrototype.setColor = function (...args) {
          const currentRoot = window.__ORC_BALL_PROFILE_METRICS__;
          const currentUi =
            window.__ORC_BALL_GAME__?.scene?.getScene('UIScene');
          if (
            currentRoot.current &&
            currentUi?.effectLineTexts?.includes(this)
          ) {
            currentRoot.current.effectColorUpdates += 1;
          }
          return originalSetColor.apply(this, args);
        };
        root.textWrapped = true;
      }

      let phase = 'idle';
      let stepping = false;
      const record = (name, eventType = powerUpType) => {
        sample.events.push({
          name,
          type: eventType,
          frame: game.loop.frame,
          phase: stepping ? 'physics' : phase,
          duringPhysics: stepping,
        });
      };
      scene.events.on('preupdate', () => {
        phase = 'physics';
      });
      // GameScene registered its POST_UPDATE flush during create, so this
      // observer runs after queued pickup work has been applied.
      scene.events.on('postupdate', () => {
        phase = 'afterPost';
      });

      const pickupCollider = scene.physics.world.colliders
        .getActive()
        .find(
          (collider) =>
            collider.object1 === scene.powerUps ||
            collider.object2 === scene.powerUps,
        );
      if (!pickupCollider) {
        throw new Error('Power-up overlap collider was not active');
      }
      const originalColliderUpdate = pickupCollider.update;
      pickupCollider.update = function (...args) {
        stepping = true;
        phase = 'physics';
        try {
          return originalColliderUpdate.apply(this, args);
        } finally {
          stepping = false;
          phase = 'afterPhysics';
        }
      };

      const originalQueueCollection = scene.queuePowerUpCollection;
      scene.queuePowerUpCollection = function (...args) {
        record('queue', args[0]);
        return originalQueueCollection.apply(this, args);
      };

      const manager = scene.powerUpManager;
      const originalCollect = manager.collect;
      manager.collect = function (...args) {
        const startedAt = performance.now();
        record('collect', args[0]);
        if (stepping) sample.collectDuringPhysics += 1;
        try {
          const result = originalCollect.apply(this, args);
          sample.collected += 1;
          return result;
        } finally {
          sample.collectDurations.push(performance.now() - startedAt);
        }
      };

      const originalToast = scene.showPowerUpToast;
      scene.showPowerUpToast = function (...args) {
        record('toast', powerUpType);
        return originalToast.apply(this, args);
      };

      const originalCreateBall = scene.createBall;
      scene.createBall = function (...args) {
        record('createBall', powerUpType);
        if (stepping) sample.bodyMutationsDuringPhysics += 1;
        return originalCreateBall.apply(this, args);
      };

      const originalSyncBodySize = scene.paddle.syncBodySize;
      scene.paddle.syncBodySize = function (...args) {
        record('syncBodySize', powerUpType);
        if (stepping) sample.bodyMutationsDuringPhysics += 1;
        return originalSyncBodySize.apply(this, args);
      };

      const originalSetEffects = scene.boardFx.setEffects;
      scene.boardFx.setEffects = function (...args) {
        const startedAt = performance.now();
        try {
          return originalSetEffects.apply(this, args);
        } finally {
          sample.boardFxDurations.push(performance.now() - startedAt);
        }
      };

      root.rafGaps.length = 0;
      root.longTasks.length = 0;
      sample.triggeredAt = performance.now();
      sample.triggeredFrame = game.loop.frame;

      const drop = scene.powerUps.create(
        scene.paddle.x,
        scene.paddle.y,
        powerUpType,
      );
      drop.body.setVelocity(0, 0);
      sample.drop = drop;
    }, {
      powerUpType: type,
      baselineP95Ms: baselineP95,
      trialNumber: trial,
    });

    await page.waitForFunction(
      (powerUpType) => {
        const sample = window.__ORC_BALL_PROFILE_METRICS__?.current;
        return sample?.type === powerUpType && sample.collected === 1;
      },
      type,
      { timeout: 5_000 },
    );
    await page.waitForTimeout(1_200);

    const result = await page.evaluate(() => {
      const game = window.__ORC_BALL_GAME__;
      const scene = game.scene.getScene('GameScene');
      const root = window.__ORC_BALL_PROFILE_METRICS__;
      const sample = root.current;
      const manager = scene.powerUpManager;
      const activeBalls = scene.balls
        .getChildren()
        .filter((ball) => ball.active);
      const gaps = root.rafGaps
        .filter((entry) => entry.at >= sample.triggeredAt)
        .map((entry) => entry.duration);
      const longTasks = root.longTasks.filter(
        (entry) => entry.at >= sample.triggeredAt,
      );
      const pickupWindowEndsAt = sample.triggeredAt + 500;
      const pickupGaps = root.rafGaps
        .filter(
          (entry) =>
            entry.at >= sample.triggeredAt &&
            entry.at <= pickupWindowEndsAt,
        )
        .map((entry) => entry.duration);
      const pickupLongTasks = longTasks.filter(
        (entry) => entry.at <= pickupWindowEndsAt,
      );
      return {
        type: sample.type,
        trial: sample.trial,
        baselineP95: sample.baselineP95,
        triggeredAt: sample.triggeredAt,
        collected: sample.collected,
        collectDurations: sample.collectDurations,
        collectDuringPhysics: sample.collectDuringPhysics,
        bodyMutationsDuringPhysics: sample.bodyMutationsDuringPhysics,
        boardFxDurations: sample.boardFxDurations,
        effectTextUpdates: sample.effectTextUpdates,
        effectTextDurations: sample.effectTextDurations,
        effectColorUpdates: sample.effectColorUpdates,
        toastTextUpdates: sample.toastTextUpdates,
        effectRegistryEvents: sample.effectRegistryEvents,
        events: sample.events,
        dropActive: Boolean(sample.drop?.active),
        dropHasScene: Boolean(sample.drop?.scene),
        pendingCollections: scene.pendingCollections.length,
        state: {
          paddleScale: manager.paddleScale,
          paddleBodyWidth: scene.paddle.body.width,
          ballCount: activeBalls.length,
          allFireball:
            activeBalls.length > 0 &&
            activeBalls.every((ball) => ball.isFireball),
          allExplosive:
            activeBalls.length > 0 &&
            activeBalls.every((ball) => ball.isExplosive),
          ballSpeeds: activeBalls.map((ball) => ball.speed),
          baseBallSpeed: scene.ballSpeed,
          sticky: manager.isSticky,
          fireball: manager.isFireball,
          laser: manager.isLaser,
          slow: manager.isSlow,
          explode: manager.isExplode,
          laserLook: scene.paddle.hasLaserLook,
          paddleTexture: scene.paddle.texture.key,
          lives: game.registry.get('lives'),
          managerLives: manager.lives,
          theme: scene.boardFx.currentTheme.id,
          effectSnapshot: game.registry.get('effectSnapshot'),
        },
        rafGaps: gaps,
        longTasks,
        pickupGaps,
        pickupLongTasks,
      };
    });

    results.push({
      type,
      trial: result.trial,
      baselineP95Ms: result.baselineP95,
      collected: result.collected,
      collectMs: Math.max(0, ...result.collectDurations),
      boardFxMs: Math.max(0, ...result.boardFxDurations),
      maxFrameMs: Math.max(0, ...result.pickupGaps),
      fullWindowMaxFrameMs: Math.max(0, ...result.rafGaps),
      p95FrameMs: percentile(result.rafGaps, 0.95),
      longTasks: result.pickupLongTasks.length,
      longestTaskMs: Math.max(
        0,
        ...result.pickupLongTasks.map((entry) => entry.duration),
      ),
      longestTaskOffsetMs: result.pickupLongTasks.reduce(
        (longest, entry) =>
          entry.duration > longest.duration
            ? {
                duration: entry.duration,
                offset: entry.at - result.triggeredAt,
              }
            : longest,
        { duration: 0, offset: 0 },
      ).offset,
      effectTextUpdates: result.effectTextUpdates,
      maxEffectTextMs: Math.max(0, ...result.effectTextDurations),
      effectColorUpdates: result.effectColorUpdates,
      toastTextUpdates: result.toastTextUpdates,
      effectRegistryEvents: result.effectRegistryEvents,
      collectDuringPhysics: result.collectDuringPhysics,
      bodyMutationsDuringPhysics: result.bodyMutationsDuringPhysics,
      dropActive: result.dropActive,
      dropHasScene: result.dropHasScene,
      pendingCollections: result.pendingCollections,
      events: result.events,
      state: result.state,
    });
    }
  }

  let stressResult = null;
  if (requestedPowerUps.length === 0) {
    await page.reload({
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForFunction(
      () =>
        window.__ORC_BALL_GAME__?.textures?.exists('powerup-expand') === true,
      undefined,
      { timeout: 30_000 },
    );
    await page.evaluate(async () => {
      const game = window.__ORC_BALL_GAME__;
      if (game.scene.isActive('UIScene')) game.scene.stop('UIScene');
      if (game.scene.isActive('GameScene')) game.scene.stop('GameScene');
      if (game.scene.isActive('MenuScene')) game.scene.stop('MenuScene');
      await new Promise((resolve) => requestAnimationFrame(resolve));
      game.registry.set('score', 0);
      game.registry.set('lives', 3);
      game.scene.start('GameScene', { level: 0 });
    });
    await page.waitForFunction(
      () => {
        const game = window.__ORC_BALL_GAME__;
        const scene = game?.scene?.getScene('GameScene');
        return (
          game?.scene?.isActive('GameScene') &&
          Boolean(scene?.powerUpManager && scene?.powerUps)
        );
      },
      undefined,
      { timeout: 10_000 },
    );
    await waitForFrames(page, 30);

    stressResult = await page.evaluate(async (powerUpTypes) => {
      const game = window.__ORC_BALL_GAME__;
      const scene = game.scene.getScene('GameScene');
      scene.serveBall();

      const pickupCollider = scene.physics.world.colliders
        .getActive()
        .find(
          (collider) =>
            collider.object1 === scene.powerUps ||
            collider.object2 === scene.powerUps,
        );
      if (!pickupCollider) throw new Error('Stress overlap collider missing');

      let inOverlap = false;
      const queued = [];
      const collected = [];
      const toasted = [];
      const spawned = [];
      const originalColliderUpdate = pickupCollider.update;
      pickupCollider.update = function (...args) {
        inOverlap = true;
        try {
          return originalColliderUpdate.apply(this, args);
        } finally {
          inOverlap = false;
        }
      };

      const originalQueue = scene.queuePowerUpCollection;
      scene.queuePowerUpCollection = function (...args) {
        queued.push({
          type: args[0],
          frame: game.loop.frame,
          inOverlap,
        });
        return originalQueue.apply(this, args);
      };

      const originalCollect = scene.powerUpManager.collect;
      scene.powerUpManager.collect = function (...args) {
        const value = originalCollect.apply(this, args);
        collected.push({
          type: args[0],
          frame: game.loop.frame,
          inOverlap,
        });
        return value;
      };

      const originalToast = scene.showPowerUpToast;
      scene.showPowerUpToast = function (...args) {
        toasted.push({
          label: args[0],
          frame: game.loop.frame,
          inOverlap,
        });
        return originalToast.apply(this, args);
      };

      for (const type of powerUpTypes) {
        const drop = scene.powerUps.create(
          scene.paddle.x,
          scene.paddle.y,
          type,
        );
        drop.body.setVelocity(0, 0);
        spawned.push(drop);
      }

      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Stress pickups did not drain')),
          5_000,
        );
        const check = () => {
          if (collected.length !== powerUpTypes.length) return;
          clearTimeout(timeout);
          scene.events.off('postupdate', check);
          const balls = scene.balls
            .getChildren()
            .filter((ball) => ball.active);
          resolve({
            queued,
            collected,
            toasted,
            pendingCollections: scene.pendingCollections.length,
            dropsCleaned: spawned.every(
              (drop) => !drop.active && !drop.scene,
            ),
            ballCount: balls.length,
            ballsValid: balls.every((ball) => {
              const body = ball.body;
              return (
                body &&
                (ball.stuckToPaddle ? !body.enable : body.enable) &&
                Number.isFinite(body.velocity.x) &&
                Number.isFinite(body.velocity.y)
              );
            }),
            allFireball: balls.every((ball) => ball.isFireball),
            allExplosive: balls.every((ball) => ball.isExplosive),
            lives: game.registry.get('lives'),
            paddleScale: scene.powerUpManager.paddleScale,
          });
        };
        scene.events.on('postupdate', check);
      });
    }, ALL_POWER_UPS);
  }

  const failures = [];
  for (const result of results) {
    const queueEvents = result.events.filter((event) => event.name === 'queue');
    const collectEvents = result.events.filter(
      (event) => event.name === 'collect',
    );
    const toastEvents = result.events.filter((event) => event.name === 'toast');
    if (result.collected !== 1) {
      failures.push(`${result.type}: collected ${result.collected} times`);
    }
    if (
      queueEvents.length !== 1 ||
      collectEvents.length !== 1 ||
      toastEvents.length !== 1
    ) {
      failures.push(
        `${result.type}: expected one queue/collect/toast event`,
      );
    } else {
      const [queued] = queueEvents;
      const [collected] = collectEvents;
      const [toasted] = toastEvents;
      if (!queued.duringPhysics) {
        failures.push(`${result.type}: overlap callback ran outside physics`);
      }
      if (collected.duringPhysics || toasted.duringPhysics) {
        failures.push(
          `${result.type}: deferred work ran inside Arcade Physics`,
        );
      }
      if (
        !Number.isFinite(queued.frame) ||
        queued.frame !== collected.frame ||
        queued.frame !== toasted.frame
      ) {
        failures.push(`${result.type}: pickup crossed frame boundaries`);
      }
    }
    if (
      result.collectDuringPhysics !== 0 ||
      result.bodyMutationsDuringPhysics !== 0
    ) {
      failures.push(`${result.type}: mutated gameplay during physics`);
    }
    if (
      result.dropActive ||
      result.dropHasScene ||
      result.pendingCollections !== 0
    ) {
      failures.push(`${result.type}: deferred pickup cleanup was incomplete`);
    }
    if (result.collectMs >= 25) {
      failures.push(
        `${result.type}: collect path took ${result.collectMs.toFixed(1)}ms`,
      );
    }
    if (result.boardFxMs >= 15) {
      failures.push(
        `${result.type}: board FX switch took ${result.boardFxMs.toFixed(1)}ms`,
      );
    }
    // One isolated Long Task can be host GC even on an otherwise steady run.
    // Reject repeated pickup-window tasks, and let the capped p95 gate below
    // reject sustained jank.
    if (result.longTasks >= 2) {
      failures.push(
        `${result.type}: ${result.longTasks} pickup-window Long Tasks (longest ${result.longestTaskMs.toFixed(1)}ms at +${result.longestTaskOffsetMs.toFixed(0)}ms)`,
      );
    }
    if (result.maxFrameMs >= 110) {
      failures.push(
        `${result.type}: ${result.maxFrameMs.toFixed(1)}ms maximum frame`,
      );
    }
    const p95Limit = Math.min(
      45,
      Math.max(35, result.baselineP95Ms * 2),
    );
    if (result.p95FrameMs > p95Limit) {
      failures.push(
        `${result.type}: ${result.p95FrameMs.toFixed(1)}ms p95 exceeded ${p95Limit.toFixed(1)}ms`,
      );
    }
    if (result.effectTextUpdates > 4) {
      failures.push(
        `${result.type}: ${result.effectTextUpdates} effect-text uploads`,
      );
    }
    if (result.maxEffectTextMs >= 25) {
      failures.push(
        `${result.type}: effect text upload took ${result.maxEffectTextMs.toFixed(1)}ms`,
      );
    }
    if (result.effectColorUpdates > 1) {
      failures.push(
        `${result.type}: ${result.effectColorUpdates} effect-color uploads`,
      );
    }
    if (result.toastTextUpdates !== 0) {
      failures.push(
        `${result.type}: pickup toast rerasterized ${result.toastTextUpdates} times`,
      );
    }
    const expectedSnapshots =
      result.type === 'MULTIBALL' || result.type === 'EXTRA_LIFE' ? 0 : 1;
    const snapshotEvents = result.effectRegistryEvents.filter(
      (key) => key === 'effectSnapshot',
    );
    const legacyEvents = result.effectRegistryEvents.filter(
      (key) => key !== 'effectSnapshot',
    );
    if (
      snapshotEvents.length !== expectedSnapshots ||
      legacyEvents.length !== 0
    ) {
      failures.push(
        `${result.type}: effect registry emitted ${snapshotEvents.length} snapshots and ${legacyEvents.length} legacy events`,
      );
    }
    validatePowerUpState(result, failures);
  }
  for (const type of POWER_UPS) {
    const trials = results.filter((result) => result.type === type);
    const stalledTrials = trials.filter(
      (result) =>
        result.longestTaskMs >= 50 || result.maxFrameMs >= 50,
    );
    if (stalledTrials.length >= 2) {
      failures.push(
        `${type}: pickup stall recurred in ${stalledTrials.length}/${trials.length} trials`,
      );
    }
  }
  if (stressResult) {
    const queuedTypes = stressResult.queued.map((event) => event.type);
    const collectedTypes = stressResult.collected.map((event) => event.type);
    const queuedFrame = stressResult.queued[0]?.frame;
    const collectedFrame = stressResult.collected[0]?.frame;
    if (
      JSON.stringify(queuedTypes) !== JSON.stringify(ALL_POWER_UPS) ||
      JSON.stringify(collectedTypes) !== JSON.stringify(ALL_POWER_UPS)
    ) {
      failures.push('stress: pickups did not preserve FIFO order');
    }
    if (
      stressResult.queued.some((event) => !event.inOverlap) ||
      stressResult.collected.some((event) => event.inOverlap) ||
      stressResult.toasted.some((event) => event.inOverlap)
    ) {
      failures.push('stress: pickup work crossed the physics boundary');
    }
    if (
      stressResult.queued.some((event) => event.frame !== queuedFrame) ||
      stressResult.collected.some((event) => event.frame !== collectedFrame) ||
      stressResult.toasted.some((event) => event.frame !== collectedFrame) ||
      queuedFrame !== collectedFrame
    ) {
      failures.push('stress: pickups were not drained in one frame');
    }
    if (
      stressResult.pendingCollections !== 0 ||
      !stressResult.dropsCleaned
    ) {
      failures.push('stress: pickup queues or drops were left behind');
    }
    if (
      stressResult.ballCount !== 3 ||
      !stressResult.ballsValid ||
      !stressResult.allFireball ||
      !stressResult.allExplosive ||
      stressResult.lives !== 4 ||
      !closeTo(stressResult.paddleScale, 0.6)
    ) {
      failures.push('stress: combined pickup postconditions were incorrect');
    }
  }
  if (pageErrors.length > 0) {
    failures.push(`browser errors: ${pageErrors.join(' | ')}`);
  }

  console.table(
    results.map((result) => ({
      type: result.type,
      trial: result.trial,
      collectMs: result.collectMs.toFixed(1),
      boardFxMs: result.boardFxMs.toFixed(1),
      baselineP95Ms: result.baselineP95Ms.toFixed(1),
      pickupMaxMs: result.maxFrameMs.toFixed(1),
      fullMaxMs: result.fullWindowMaxFrameMs.toFixed(1),
      p95FrameMs: result.p95FrameMs.toFixed(1),
      longTasks: result.longTasks,
      textUploads: result.effectTextUpdates,
      maxTextMs: result.maxEffectTextMs.toFixed(1),
      colorUploads: result.effectColorUpdates,
      toastUploads: result.toastTextUpdates,
      physicsMutations:
        result.collectDuringPhysics + result.bodyMutationsDuringPhysics,
    })),
  );
  console.log(`CPU throttle: ${CPU_RATE}x`);
  if (stressResult) {
    console.log(
      `Same-frame stress: ${stressResult.collected.length}/${ALL_POWER_UPS.length} pickups drained in FIFO order`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`Power-up performance regression:\n- ${failures.join('\n- ')}`);
  }
} finally {
  await browser?.close();
  if (!server.killed) server.kill('SIGTERM');
}
