import path from 'path';
import { defineConfig } from 'vitest/config';

// Standalone from vite.config.ts: the unit suite covers pure logic only, so it
// skips the React and Tailwind plugins entirely.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
