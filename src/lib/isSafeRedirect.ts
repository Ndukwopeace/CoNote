import { ROUTES } from './routes'

function hasControlCharacter(value: string) {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

function looksProtocolRelative(path: string) {
  return path.startsWith('//') || path.startsWith('/\\')
}

/**
 * True only for a relative path that stays on `origin`. Blocks open redirects through the
 * `?redirect=` parameter (ENGINEERING_STANDARDS.md 6.2).
 */
export function isSafeRedirect(path: string | null | undefined, origin: string): path is string {
  if (!path?.startsWith('/')) return false
  if (looksProtocolRelative(path) || hasControlCharacter(path)) return false

  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return false
  }
  if (looksProtocolRelative(decoded) || hasControlCharacter(decoded)) return false

  try {
    return new URL(path, origin).origin === origin
  } catch {
    return false
  }
}

/** The path to go to after sign-in: the requested one if safe, otherwise the dashboard. */
export function safeRedirectTarget(path: string | null | undefined, origin: string) {
  return isSafeRedirect(path, origin) ? path : ROUTES.dashboard
}
