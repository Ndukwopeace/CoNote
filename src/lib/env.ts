import { z } from 'zod'

export type AppEnv =
  { dataSource: 'mock' } | { dataSource: 'supabase'; supabaseUrl: string; supabaseAnonKey: string }

const dataSourceSchema = z.object({
  VITE_DATA_SOURCE: z.enum(['mock', 'supabase']).default('mock'),
})

const supabaseSchema = z.object({
  VITE_SUPABASE_URL: z.url({ protocol: /^https$/, error: 'must be an https URL' }),
  VITE_SUPABASE_ANON_KEY: z.string({ error: 'is required' }).min(1, 'is required'),
})

function describe(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')
}

/** Validates build-time environment variables and fails fast with a readable message. */
export function parseEnv(raw: Record<string, unknown>): AppEnv {
  const base = dataSourceSchema.safeParse(raw)
  if (!base.success) throw new Error(`Invalid environment: ${describe(base.error)}`)

  if (base.data.VITE_DATA_SOURCE === 'mock') return { dataSource: 'mock' }

  const supabase = supabaseSchema.safeParse(raw)
  if (!supabase.success) throw new Error(`Invalid environment: ${describe(supabase.error)}`)

  return {
    dataSource: 'supabase',
    supabaseUrl: supabase.data.VITE_SUPABASE_URL,
    supabaseAnonKey: supabase.data.VITE_SUPABASE_ANON_KEY,
  }
}

export const env = parseEnv(import.meta.env)
