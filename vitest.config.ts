import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        // ENGINEERING_STANDARDS.md section 2.6: the floor applies to logic folders only.
        include: ['src/services/**', 'src/hooks/**', 'src/lib/**', 'src/features/**'],
        exclude: ['**/*.test.{ts,tsx}', '**/*.contract.ts', '**/types.ts', '**/seed/**'],
        thresholds: { lines: 80, branches: 80 },
      },
    },
  }),
)
