/**
 * Runs the shared AuthService contract against a real Supabase project, plus the checks only a
 * real backend can answer (inactive accounts, where the session is kept). It is skipped unless
 * VITE_SUPABASE_TEST_* variables point at a project, so `npm test` never touches the network. CI
 * starts a local Supabase stack and sets them (see the "Supabase contract tests" job).
 */

// Vitest building blocks.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// The client, the storage that honours "Remember me", and the key the session is kept under.
import { createSupabaseClient } from '@conote/supabase/client'
import { createRememberStorage } from '@conote/supabase/rememberStorage'

// The shared contract every AuthService must meet.
import { runAuthServiceContract } from '../contracts/authService.contract'

// The implementation under test.
import { createSupabaseAuthService } from './supabaseAuthService'

/** A setting from the environment, or undefined when it is missing or empty. */
function setting(name: string): string | undefined {
  // Vitest exposes only VITE_-prefixed variables to tests.
  const value: unknown = import.meta.env[name]
  return typeof value === 'string' && value !== '' ? value : undefined
}

// The project to test against. All are required for the suite to run.
const URL = setting('VITE_SUPABASE_TEST_URL')
const ANON_KEY = setting('VITE_SUPABASE_TEST_ANON_KEY')
// An active student who exists in that project, and a suspended one (same password).
const EMAIL = setting('VITE_SUPABASE_TEST_EMAIL')
const PASSWORD = setting('VITE_SUPABASE_TEST_PASSWORD')
const SUSPENDED_EMAIL = setting('VITE_SUPABASE_TEST_SUSPENDED_EMAIL')

// A password that is certainly wrong: the real one with something added. Built from the setting
// rather than written out, so no password-looking text sits in the source.
const WRONG_PASSWORD = `${PASSWORD ?? ''}-not`

// A name for the stored session, so tests do not touch the app's real one.
const STORAGE_KEY = 'conote-test-auth'

/** A fresh service over empty browser storage, as a first visit would be. */
function createFresh() {
  window.localStorage.clear()
  window.sessionStorage.clear()
  const rememberStorage = createRememberStorage({
    local: window.localStorage,
    session: window.sessionStorage,
    flagKey: 'conote-test-remember',
  })
  const client = createSupabaseClient({
    url: URL ?? '',
    anonKey: ANON_KEY ?? '',
    storage: rememberStorage.storage,
    storageKey: STORAGE_KEY,
  })
  const service = createSupabaseAuthService({
    client,
    rememberStorage,
    storageKey: STORAGE_KEY,
    origin: 'http://localhost:4173',
  })
  return { service, client }
}

describe.skipIf(!URL || !ANON_KEY || !EMAIL || !PASSWORD || !SUSPENDED_EMAIL)(
  'Supabase auth service',
  () => {
    // Every test ends signed out, so one test cannot leave a session for the next.
    afterEach(async () => {
      await createFresh().service.signOut()
    })

    runAuthServiceContract('Supabase', {
      create: () => createFresh().service,
      validCredentials: { email: EMAIL ?? '', password: PASSWORD ?? '' },
    })

    describe('beyond the contract', () => {
      beforeEach(() => {
        window.localStorage.clear()
        window.sessionStorage.clear()
      })

      // Proves a wrong password gives the message the form shows, not a raw server answer.
      it('rejects a wrong password with a validation error', async () => {
        await expect(
          createFresh().service.signIn({
            email: EMAIL ?? '',
            password: WRONG_PASSWORD,
            remember: false,
          }),
        ).rejects.toMatchObject({ kind: 'validation', message: 'Email or password is incorrect.' })
      })

      // SECURITY: proves an account an administrator has suspended cannot sign in, and leaves no
      // session behind.
      it('refuses a suspended account and leaves no session', async () => {
        const { service } = createFresh()
        await expect(
          service.signIn({
            email: SUSPENDED_EMAIL ?? '',
            password: PASSWORD ?? '',
            remember: false,
          }),
        ).rejects.toMatchObject({ kind: 'forbidden' })
        await expect(service.getSession()).resolves.toBeNull()
      })

      // SECURITY: proves a session that was not remembered never reaches long-lived storage.
      it('keeps an unremembered session out of localStorage', async () => {
        const { service } = createFresh()
        await service.signIn({ email: EMAIL ?? '', password: PASSWORD ?? '', remember: false })
        expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
        expect(window.sessionStorage.getItem(STORAGE_KEY)).not.toBeNull()
      })

      // Proves a remembered session survives a reload (a new service over the same storage).
      it('restores a remembered session after a reload', async () => {
        const first = createFresh()
        await first.service.signIn({ email: EMAIL ?? '', password: PASSWORD ?? '', remember: true })
        expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull()
        // Rebuild everything over the same storage, without clearing it.
        const rememberStorage = createRememberStorage({
          local: window.localStorage,
          session: window.sessionStorage,
          flagKey: 'conote-test-remember',
        })
        const reloaded = createSupabaseAuthService({
          client: createSupabaseClient({
            url: URL ?? '',
            anonKey: ANON_KEY ?? '',
            storage: rememberStorage.storage,
            storageKey: STORAGE_KEY,
          }),
          rememberStorage,
          storageKey: STORAGE_KEY,
          origin: 'http://localhost:4173',
        })
        await expect(reloaded.getSession()).resolves.toMatchObject({
          user: { email: EMAIL, role: 'student' },
        })
      })

      // SECURITY: proves signing out removes the stored session from this computer.
      it('clears stored sessions on sign-out', async () => {
        const { service } = createFresh()
        await service.signIn({ email: EMAIL ?? '', password: PASSWORD ?? '', remember: true })
        await service.signOut()
        expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
        expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
      })

      // Proves changing the password needs the right current password.
      it('refuses a password change with the wrong current password', async () => {
        const { service } = createFresh()
        await service.signIn({ email: EMAIL ?? '', password: PASSWORD ?? '', remember: false })
        await expect(service.updatePassword(WRONG_PASSWORD, 'longenough1')).rejects.toMatchObject({
          kind: 'validation',
          message: 'Your current password is incorrect.',
        })
      })
    })
  },
)
