/**
 * The settings every function reads from the environment. Supabase provides the first three to
 * each function; the three app addresses are secrets set once per project, so the emails link to
 * the right app for each role.
 */

/** The checked settings. */
export interface FunctionEnv {
  // The project's address.
  url: string
  // The public key. It is meant to be public; Row Level Security protects the data.
  anonKey: string
  // SECURITY: the server key bypasses Row Level Security. It stays in this runtime and is never
  // sent to a browser or written to a response.
  serviceKey: string
  // Where each app lives, such as "https://app.example". No trailing slash.
  appUrls: { student: string; teacher: string; admin: string }
}

/** The names of the settings, in the order of `FunctionEnv`. */
const NAMES = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'APP_URL_STUDENT',
  'APP_URL_TEACHER',
  'APP_URL_ADMIN',
] as const

/**
 * Reads the settings with `get`. Throws naming the ones that are missing, so a function with a
 * missing setting fails loudly at start-up instead of sending a broken link.
 */
export function readEnv(get: (name: string) => string | undefined): FunctionEnv {
  // The value of each name, empty when unset.
  const values = NAMES.map((name) => [name, get(name) ?? ''] as const)
  // Every name that has no value.
  const missing = values.filter(([, value]) => value === '').map(([name]) => name)
  if (missing.length > 0) {
    throw new Error(`Missing settings: ${missing.join(', ')}`)
  }
  // Looks up a value that was just checked to exist.
  const at = (name: (typeof NAMES)[number]) => values.find(([key]) => key === name)?.[1] ?? ''
  // An address without a trailing slash, so paths can be added to it.
  const trimmed = (name: (typeof NAMES)[number]) => at(name).replace(/\/+$/, '')
  return {
    url: at('SUPABASE_URL'),
    anonKey: at('SUPABASE_ANON_KEY'),
    serviceKey: at('SUPABASE_SERVICE_ROLE_KEY'),
    appUrls: {
      student: trimmed('APP_URL_STUDENT'),
      teacher: trimmed('APP_URL_TEACHER'),
      admin: trimmed('APP_URL_ADMIN'),
    },
  }
}

/** The page of each app that opens a password link, by the role of the person it is for. */
const RESET_PATHS = {
  student: '/reset-password',
  teacher: '/teacher/reset-password',
  admin: '/admin/reset-password',
} as const

/** The address a password email for someone with `role` should open. */
export function resetAddress(env: FunctionEnv, role: keyof typeof RESET_PATHS): string {
  return `${env.appUrls[role]}${RESET_PATHS[role]}`
}
