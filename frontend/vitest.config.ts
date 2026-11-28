import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.mts'],
    exclude: ['node_modules/**', 'e2e/**'],
  },
});
