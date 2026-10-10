/**
 * Turns anything Supabase throws or returns into the app's own AppError, so screens handle one
 * short list of cases (ENGINEERING_STANDARDS.md section 5). Used by every Supabase service.
 */

// The app's error type and the generic converter for errors that are not Supabase's.
import { AppError, toAppError, type AppErrorKind } from '@conote/core/errors'

/** The text and kind a known failure becomes. */
interface Mapped {
  kind: AppErrorKind
  message: string
}

// Shown for every kind of rate limit, so the wording does not reveal which limit was hit.
const TOO_MANY: Mapped = {
  kind: 'validation',
  message: 'Too many attempts. Wait a few minutes and try again.',
}

// Shown when a session is missing or expired.
const SESSION_ENDED: Mapped = {
  kind: 'unauthorized',
  message: 'Your session has ended. Sign in again.',
}

/** Supabase Auth error codes whose meaning we explain to the user. */
const AUTH_CODES: Readonly<Record<string, Mapped>> = {
  invalid_credentials: { kind: 'validation', message: 'Email or password is incorrect.' },
  email_not_confirmed: {
    kind: 'validation',
    message: 'Confirm your email address first. Check your inbox.',
  },
  weak_password: { kind: 'validation', message: 'Choose a stronger password.' },
  same_password: { kind: 'validation', message: 'Choose a password you have not used before.' },
  user_already_exists: { kind: 'conflict', message: 'An account with this email already exists.' },
  over_request_rate_limit: TOO_MANY,
  over_email_send_rate_limit: TOO_MANY,
  session_not_found: SESSION_ENDED,
  bad_jwt: SESSION_ENDED,
  user_banned: { kind: 'forbidden', message: 'This account is not active.' },
}

/** Postgres and PostgREST error codes, mapped to a kind with a safe generic message. */
const DATABASE_CODES: Readonly<Record<string, Mapped>> = {
  // insufficient_privilege: a Row Level Security policy or a function check said no.
  '42501': { kind: 'forbidden', message: 'You do not have access to this.' },
  // PostgREST: the token is missing, expired or invalid.
  PGRST301: SESSION_ENDED,
  // PostgREST: a single-row query found nothing.
  PGRST116: { kind: 'not_found', message: 'We could not find that.' },
  // Our functions raise P0002 for "not found".
  P0002: { kind: 'not_found', message: 'We could not find that.' },
  // unique_violation, and serialization_failure (our "stale version" signal).
  '23505': {
    kind: 'conflict',
    message: 'That was already done, or someone else changed it first.',
  },
  '40001': {
    kind: 'conflict',
    message: 'This changed while you were working. Reload and try again.',
  },
  // check_violation, invalid_parameter_value and foreign_key_violation: the input was refused.
  '23514': { kind: 'validation', message: 'That change is not allowed.' },
  '22023': { kind: 'validation', message: 'That change is not allowed.' },
  '23503': { kind: 'validation', message: 'That change refers to something that does not exist.' },
}

/** True for a plain object, so its fields can be read safely. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** The mapping for `error`'s code, if we have one. */
function lookup(error: Record<string, unknown>): Mapped | undefined {
  // Auth errors carry a string `code`; so do PostgREST and Postgres errors.
  const code = error.code
  if (typeof code !== 'string') return undefined
  // Auth codes and database codes never overlap, so one lookup order is enough.
  return AUTH_CODES[code] ?? DATABASE_CODES[code]
}

/**
 * Converts anything thrown or returned by supabase-js into an AppError.
 * SECURITY: the raw message can name tables, columns or SQL, so it is never copied into the
 * AppError's message. It stays in `cause` for developers and error reports.
 */
export function fromSupabaseError(error: unknown): AppError {
  // Already ours: pass it through.
  if (error instanceof AppError) return error
  // A failed fetch is a TypeError; the shared converter recognises it as a network problem.
  if (error instanceof TypeError) return toAppError(error)
  if (isRecord(error)) {
    // A dropped connection is reported by name or by a zero status.
    if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
      return new AppError('network', 'Network request failed', { cause: error })
    }
    // A code we recognise gets its explained message.
    const mapped = lookup(error)
    if (mapped) return new AppError(mapped.kind, mapped.message, { cause: error })
    // Supabase errors we do not recognise: generic text, original kept as the cause.
    if (typeof error.message === 'string') {
      return new AppError('unknown', 'Unexpected error', { cause: error })
    }
  }
  // Everything else (a TypeError from fetch, a string, undefined) uses the shared converter.
  return toAppError(error)
}
