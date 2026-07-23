import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Absolute base so assets resolve correctly on Vercel (and local preview)
  base: '/',
  build: {
    rollupOptions: {
      output: {
        // Vite 8 / Rolldown expects a function (object form is rejected)
        manualChunks(id: string) {
          if (id.includes('node_modules/phaser')) return 'phaser';
        },
      },
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
