import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 180_000,
    // Integration tests start an embedded Postgres; keep files sequential to avoid port clashes.
    fileParallelism: false,
  },
});
