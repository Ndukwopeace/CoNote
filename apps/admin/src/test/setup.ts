/**
 * Runs before every test file (vitest.config.ts → setupFiles). The common setup is shared by every
 * CoNote app (packages/testing).
 */

// DOM matchers, cleanup and fresh storage after each test.
import '@conote/testing/setup'
