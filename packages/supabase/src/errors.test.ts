/**
 * Tests for turning Supabase failures into the app's own error type. Services throw only
 * AppError, so a screen never sees a raw database message (ENGINEERING_STANDARDS.md section 5).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The app's error type.
import { AppError } from '@conote/core/errors'

// The function under test.
import { fromSupabaseError } from './errors'

describe('fromSupabaseError', () => {
  // Proves an error that is already an AppError passes through untouched.
  it('keeps an AppError as it is', () => {
    const original = new AppError('conflict', 'Already there.')
    expect(fromSupabaseError(original)).toBe(original)
  })

  // Proves each known sign-in failure becomes a message the form can show.
  it.each([
    ['invalid_credentials', 'validation', 'Email or password is incorrect.'],
    ['email_not_confirmed', 'validation', 'Confirm your email address first. Check your inbox.'],
    ['weak_password', 'validation', 'Choose a stronger password.'],
    [
      'over_request_rate_limit',
      'validation',
      'Too many attempts. Wait a few minutes and try again.',
    ],
    [
      'over_email_send_rate_limit',
      'validation',
      'Too many attempts. Wait a few minutes and try again.',
    ],
    ['user_already_exists', 'conflict', 'An account with this email already exists.'],
    ['same_password', 'validation', 'Choose a password you have not used before.'],
    ['session_not_found', 'unauthorized', 'Your session has ended. Sign in again.'],
    ['bad_jwt', 'unauthorized', 'Your session has ended. Sign in again.'],
    ['user_banned', 'forbidden', 'This account is not active.'],
  ] as const)('maps the auth code %s', (code, kind, message) => {
    const result = fromSupabaseError({ name: 'AuthApiError', code, status: 400, message: 'raw' })
    expect(result).toBeInstanceOf(AppError)
    expect(result).toMatchObject({ kind, message })
  })

  // Proves a dropped connection is reported as a network problem.
  it('maps a failed fetch to network', () => {
    expect(
      fromSupabaseError({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }),
    ).toMatchObject({ kind: 'network' })
    expect(fromSupabaseError(new TypeError('Failed to fetch'))).toMatchObject({ kind: 'network' })
  })

  // Proves database errors map by their Postgres code.
  it.each([
    ['42501', 'forbidden'],
    ['PGRST301', 'unauthorized'],
    ['PGRST116', 'not_found'],
    ['23505', 'conflict'],
    ['40001', 'conflict'],
    ['23514', 'validation'],
    ['22023', 'validation'],
    ['P0002', 'not_found'],
    ['23503', 'validation'],
  ] as const)('maps the database code %s to %s', (code, kind) => {
    expect(fromSupabaseError({ code, message: 'raw', details: '', hint: '' })).toMatchObject({
      kind,
    })
  })

  // SECURITY: proves raw messages (SQL, table names, stack traces) never reach the screen.
  it('never exposes the raw message', () => {
    const result = fromSupabaseError({
      code: 'XX000',
      message: 'relation "public.notes" does not exist at character 15',
      details: 'secret detail',
      hint: '',
    })
    expect(result.kind).toBe('unknown')
    expect(result.message).not.toContain('notes')
    expect(result.message).not.toContain('secret')
    // The original is kept for developers.
    expect(result.cause).toMatchObject({ code: 'XX000' })
  })

  // Proves unknown values still become an AppError.
  it('wraps anything else as unknown', () => {
    expect(fromSupabaseError('boom')).toMatchObject({ kind: 'unknown' })
    expect(fromSupabaseError(undefined)).toMatchObject({ kind: 'unknown' })
  })
})
