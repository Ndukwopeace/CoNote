/**
 * The student app's checked build-time configuration (ENGINEERING_STANDARDS.md 6.3). The rules
 * live in @conote/core, shared with the other apps.
 */

// The shared parser.
import { parseEnv } from '@conote/core/env'

// The configuration type, re-exported for the modules that take it as a parameter.
export type { AppEnv } from '@conote/core/env'

// Parsed once when the app loads; every other module imports this checked result.
// SECURITY: each variable is read by name. Vite replaces `import.meta.env.VITE_X` with that one
// value, but a bare `import.meta.env` becomes an object holding EVERY VITE_ variable present at
// build time, which would print a key set for tests (or by mistake) into the public JavaScript.
export const env = parseEnv({
  VITE_DATA_SOURCE: import.meta.env.VITE_DATA_SOURCE,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
})
