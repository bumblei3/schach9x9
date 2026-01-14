import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'threads', // Use threads instead of forks to avoid worker crash issues
    setupFiles: ['./tests/vitest.setup.ts'],
    include: ['tests/**/*.{test,unit.test,integration.test}.{js,ts}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/browser/**',
      '**/*.spec.{js,ts}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: ['node_modules/**', 'dist/**', 'tests/**', 'e2e/**'],
    },
  },
});
