import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    clearMocks: true,
    globals: false,
    reporters: 'default',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
