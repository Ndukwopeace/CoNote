/**
 * The teacher app's checked build-time configuration (ENGINEERING_STANDARDS.md 6.3). The rules live
 * in @conote/core, shared with the other apps.
 */

// The shared parser.
import { parseEnv } from '@conote/core/env'

// The configuration type, re-exported for the modules that take it as a parameter.
export type { AppEnv } from '@conote/core/env'

// Parsed once when the app loads; every other module imports this checked result.
export const env = parseEnv(import.meta.env)
