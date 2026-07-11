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
      // Repro/debug scratch files: they document reproduced bugs but contain
      // no assertions (always green). Keep them as reference, but don't let
      // them count as tests or pollute coverage.
      '**/_repro/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['node_modules/**', 'dist/**', 'tests/**', 'e2e/**'],
      // Fail the CI run if coverage drops below these floors. Without this,
      // coverage could silently regress to 0% and the job would still pass.
      thresholds: {
        lines: 85,
        branches: 70,
        functions: 80,
        statements: 87,
      },
    },
  },
});
