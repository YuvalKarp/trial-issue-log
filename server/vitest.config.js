import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './tests/global-setup.js',
    // All test files share one test database, so they run one at a time.
    fileParallelism: false,
  },
});
