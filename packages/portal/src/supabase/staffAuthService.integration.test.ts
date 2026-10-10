/**
 * Runs the staff AuthService contract against a real Supabase project, plus the checks only a
 * real backend can answer (a suspended administrator, where the session is kept). It is skipped
 * unless VITE_SUPABASE_TEST_* variables point at a project, so `npm test` never touches the
 * network. CI starts a local Supabase stack and sets them (the "Supabase contract tests" job).
 *
 * It creates its own throwaway administrators with the server key, so the contract's password
 * resets cannot spoil the seed's accounts. NEVER point it at a hosted project.
 */

// The SDK, to talk to the stack as the server.
import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js'
// Vitest building blocks.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// The client, and the storage that honours "Remember me".
import { createSupabaseClient } from '@conote/supabase/client'
import { createRememberStorage } from '@conote/supabase/rememberStorage'

// The shared contract every AuthService must meet.
import { describeAuthServiceContract } from '../auth/authService.contract'
// The implementation under test.
import { createSupabaseStaffAuthService } from './staffAuthService'

/** A setting from the environment, or undefined when it is missing or empty. */
function setting(name: string): string | undefined {
  // Vitest exposes only VITE_-prefixed variables to tests.
  const value: unknown = import.meta.env[name]
  return typeof value === 'string' && value !== '' ? value : undefined
}

// The project to test against, and the server key that lets the test create accounts.
const URL = setting('VITE_SUPABASE_TEST_URL')
const ANON_KEY = setting('VITE_SUPABASE_TEST_ANON_KEY')
const SERVICE_KEY = setting('VITE_SUPABASE_TEST_SERVICE_KEY')

// A name for the stored session, so tests do not touch the app's real one.
const STORAGE_KEY = 'conote-test-staff-auth'
// A suffix that makes this run's accounts unique.
const RUN = Math.random().toString(36).slice(2, 10)
// The throwaway administrator the contract signs in as, and a suspended one.
const ADMIN = {
  email: `staff-contract-${RUN}@conote.example`,
  password: `Start-${RUN}-2026`,
  fullName: 'Contract Admin',
  role: 'admin',
}
const SUSPENDED_EMAIL = `staff-suspended-${RUN}@conote.example`

/** A client with the server key, which bypasses Row Level Security. */
function serverClient(): SupabaseClient {
  const options: SupabaseClientOptions<'public'> = { auth: { persistSession: false } }
  const client = createClient(URL ?? '', SERVICE_KEY ?? '', options)
  return client
}

/** A fresh staff service over empty browser storage, as a first visit would be. */
function createFresh() {
  window.localStorage.clear()
  window.sessionStorage.clear()
  const rememberStorage = createRememberStorage({
    local: window.localStorage,
    session: window.sessionStorage,
    flagKey: 'conote-test-staff-remember',
  })
  const client = createSupabaseClient({
    url: URL ?? '',
    anonKey: ANON_KEY ?? '',
    storage: rememberStorage.storage,
    storageKey: STORAGE_KEY,
  })
  const service = createSupabaseStaffAuthService({
    client,
    rememberStorage,
    storageKey: STORAGE_KEY,
    origin: 'http://localhost:4174',
    resetPath: '/admin/reset-password',
  })
  return { service, client }
}

/** Waits `ms` milliseconds. */
const pause = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe.skipIf(!URL || !ANON_KEY || !SERVICE_KEY)('Supabase staff auth service', () => {
  // The accounts' IDs, to put them back between tests.
  const ids: { admin?: string | undefined; suspended?: string | undefined } = {}
  // Built when the suite starts, because a skipped suite still runs this body once.
  let server: SupabaseClient

  beforeAll(async () => {
    server = serverClient()
    // SECURITY: the role and status come from app_metadata, which only the server can set.
    const admin = await server.auth.admin.createUser({
      email: ADMIN.email,
      password: ADMIN.password,
      email_confirm: true,
      user_metadata: { full_name: ADMIN.fullName },
      app_metadata: { role: 'admin' },
    })
    ids.admin = admin.data.user?.id
    const suspended = await server.auth.admin.createUser({
      email: SUSPENDED_EMAIL,
      password: ADMIN.password,
      email_confirm: true,
      app_metadata: { role: 'admin', status: 'suspended' },
    })
    ids.suspended = suspended.data.user?.id
  })

  afterAll(async () => {
    // Leave the stack as it was found.
    if (ids.admin) await server.auth.admin.deleteUser(ids.admin)
    if (ids.suspended) await server.auth.admin.deleteUser(ids.suspended)
  })

  describeAuthServiceContract('Supabase', {
    createService: () => {
      const { service } = createFresh()
      return {
        ...service,
        // Supabase allows one email per second to an address; the contract asks faster.
        requestPasswordReset: async (email) => {
          await pause(1100)
          return service.requestPasswordReset(email)
        },
      }
    },
    account: ADMIN,
    // The email goes to a mail catcher nobody reads, so the server key makes the same link.
    resetCodeFrom: async () => {
      const { data, error } = await server.auth.admin.generateLink({
        type: 'recovery',
        email: ADMIN.email,
      })
      if (error) throw error
      return data.properties.hashed_token
    },
    // A reset in one test must not change the password the next test signs in with.
    beforeEachTest: async () => {
      if (!ids.admin) throw new Error('The test administrator was not created.')
      await server.auth.admin.updateUserById(ids.admin, { password: ADMIN.password })
    },
  })

  describe('beyond the contract', () => {
    // SECURITY: proves an administrator an administrator has suspended cannot sign in, and
    // leaves no session behind.
    it('refuses a suspended account and leaves no session', async () => {
      const { service } = createFresh()
      await expect(
        service.signIn({ email: SUSPENDED_EMAIL, password: ADMIN.password }),
      ).rejects.toMatchObject({ kind: 'forbidden' })
      await expect(service.getSession()).resolves.toBeNull()
    })

    // SECURITY: proves a staff session lives in sessionStorage only, so it ends with the tab.
    it('keeps the session out of localStorage', async () => {
      const { service } = createFresh()
      await service.signIn({ email: ADMIN.email, password: ADMIN.password })
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
      expect(window.sessionStorage.getItem(STORAGE_KEY)).not.toBeNull()
    })

    // SECURITY: proves signing out removes the stored session from this computer.
    it('clears the stored session on sign-out', async () => {
      const { service } = createFresh()
      await service.signIn({ email: ADMIN.email, password: ADMIN.password })
      await service.signOut()
      expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
    })
  })
})
