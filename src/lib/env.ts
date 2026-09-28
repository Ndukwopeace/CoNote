/**
 * Reads and checks the build-time environment variables (VITE_*). The app refuses to start
 * with a clear message instead of running half-configured (ENGINEERING_STANDARDS.md 6.3).
 */

// zod describes the expected shape and reports exactly what is wrong.
import { z } from 'zod'

/** The checked configuration the rest of the app uses. Supabase settings exist only in Supabase mode. */
export type AppEnv =
  // Demo mode needs no extra settings.
  | { dataSource: 'mock' }
  // Supabase mode needs the project URL and the public (anon) key.
  | { dataSource: 'supabase'; supabaseUrl: string; supabaseAnonKey: string }

// Rule for choosing the data source.
const dataSourceSchema = z.object({
  // Only these two values are valid. Leaving it unset means demo data.
  VITE_DATA_SOURCE: z.enum(['mock', 'supabase']).default('mock'),
})

// Rules that apply only when the data source is Supabase.
const supabaseSchema = z.object({
  // SECURITY: https only, so the session token is never sent in plain text where anyone on the
  // same Wi-Fi could read it.
  VITE_SUPABASE_URL: z.url({ protocol: /^https$/, error: 'must be an https URL' }),
  // The anon key must be present. It is public by design; Row Level Security protects the data.
  VITE_SUPABASE_ANON_KEY: z.string({ error: 'is required' }).min(1, 'is required'),
})

/** Turns zod's error list into one readable line, e.g. "VITE_SUPABASE_URL must be an https URL". */
function describe(error: z.ZodError) {
  // Join each problem's variable name and message, separated by semicolons.
  return error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')
}

/** Validates build-time environment variables and fails fast with a readable message. */
export function parseEnv(raw: Record<string, unknown>): AppEnv {
  // Check the data source first; the other rules depend on it.
  const base = dataSourceSchema.safeParse(raw)
  // An unknown value such as "firebase" stops the app with a clear message.
  if (!base.success) throw new Error(`Invalid environment: ${describe(base.error)}`)

  // Demo mode is complete at this point.
  if (base.data.VITE_DATA_SOURCE === 'mock') return { dataSource: 'mock' }

  // Supabase mode: check the URL and key.
  const supabase = supabaseSchema.safeParse(raw)
  // Missing or insecure settings stop the app instead of failing later in confusing ways.
  if (!supabase.success) throw new Error(`Invalid environment: ${describe(supabase.error)}`)

  // Hand back the checked values under friendlier names.
  return {
    dataSource: 'supabase',
    supabaseUrl: supabase.data.VITE_SUPABASE_URL,
    supabaseAnonKey: supabase.data.VITE_SUPABASE_ANON_KEY,
  }
}

// Parsed once when the app loads; every other module imports this checked result.
export const env = parseEnv(import.meta.env)
