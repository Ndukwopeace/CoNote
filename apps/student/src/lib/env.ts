/**
 * The student app's checked build-time configuration (ENGINEERING_STANDARDS.md 6.3). The rules
 * live in @conote/core, shared with the other apps.
 */

// The shared parser.
import { parseEnv, type AppEnv } from '@conote/core/env'

// Re-exported for the modules that take the configuration as a parameter.
export type { AppEnv }

// Parsed once when the app loads; every other module imports this checked result.
export const env = parseEnv(import.meta.env)
