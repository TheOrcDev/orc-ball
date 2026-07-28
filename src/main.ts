import { inject } from '@vercel/analytics';
import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { UIScene } from './scenes/UIScene';

// Vercel Web Analytics (this is a Vite SPA — not Next.js)
inject();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'game',
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3,
    // Avoid browser scrolling/zooming while playing on mobile
    windowEvents: true,
  },
  scene: [BootScene, MenuScene, GameScene, UIScene],
};

const game = new Phaser.Game(config);

// Opt-in development bridge for the deterministic pickup profiler.
if (
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has('profile')
) {
  (
    window as Window & {
      __ORC_BALL_GAME__?: Phaser.Game;
    }
  ).__ORC_BALL_GAME__ = game;
}
