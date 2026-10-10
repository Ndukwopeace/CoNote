/**
 * A stand-in for the Supabase client, for unit tests that need to see exactly which calls a
 * service makes and how it reacts to each answer. The real client is exercised by the
 * integration contract run against a real stack (supabaseAuthService.integration.test.ts).
 */

// Mock functions that record calls.
import { vi } from 'vitest'

// The types the service uses.
import type {
  AuthChangeEvent,
  Session as SupabaseSession,
  SupabaseClient,
} from '@supabase/supabase-js'

// The storage adapter the service writes to, with the "Remember me" switch.
import { createRememberStorage } from '@conote/supabase/rememberStorage'

/** The ID of the account every fake sign-in belongs to. */
export const USER_ID = '10000000-0000-0000-0000-000000000004'

/** A profile row as the database returns it. */
export function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    role: 'student',
    status: 'active',
    full_name: 'Victory Eze',
    email: 'student@conote.example',
    avatar_url: null,
    ...overrides,
  }
}

/** A Supabase session for the fake account. */
export function supabaseSession(): SupabaseSession {
  return {
    access_token: 'a',
    refresh_token: 'r',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: USER_ID, email: 'student@conote.example' },
  } as SupabaseSession
}

/** What a call can answer. */
interface Answer {
  data: unknown
  error: unknown
}

/** An ordinary successful answer carrying a session. */
const SIGNED_IN: Answer = {
  data: { session: supabaseSession(), user: { id: USER_ID } },
  error: null,
}

/** Builds the fake client, the storage it uses, and handles for the test to steer it. */
export function createFakeSupabase() {
  // The fake page storage, so tests can check what was kept where.
  const rememberStorage = createRememberStorage({
    local: window.localStorage,
    session: window.sessionStorage,
    flagKey: 'fake-remember',
  })
  // The function the service registered to hear about changes.
  let callback: ((event: AuthChangeEvent, session: SupabaseSession | null) => void) | null = null
  const unsubscribe = vi.fn()
  // The profile query ends with this answer; tests replace it.
  // `hold`, when set, keeps the profile query waiting until the promise settles, so a test can
  // sign out while a read is still in flight.
  // `holds` keeps the next profile reads waiting, one promise per read, in the order they start.
  const profile: { answer: Answer; hold: Promise<void> | null; holds: Promise<void>[] } = {
    answer: { data: profileRow(), error: null },
    hold: null,
    holds: [],
  }

  const auth = {
    getSession: vi.fn<() => Promise<Answer>>(() =>
      Promise.resolve({ data: { session: null }, error: null }),
    ),
    getUser: vi.fn<() => Promise<Answer>>(() =>
      Promise.resolve({ data: { user: { email: 'student@conote.example' } }, error: null }),
    ),
    signInWithPassword: vi.fn<(c: unknown) => Promise<Answer>>(() => Promise.resolve(SIGNED_IN)),
    signUp: vi.fn<(c: unknown) => Promise<Answer>>(() => Promise.resolve(SIGNED_IN)),
    signInWithOAuth: vi.fn<(c: unknown) => Promise<Answer>>(() =>
      Promise.resolve({ data: {}, error: null }),
    ),
    signOut: vi.fn<(c: unknown) => Promise<Answer>>(() =>
      Promise.resolve({ data: {}, error: null }),
    ),
    resetPasswordForEmail: vi.fn<(e: string, o: unknown) => Promise<Answer>>(() =>
      Promise.resolve({ data: {}, error: null }),
    ),
    verifyOtp: vi.fn<(c: unknown) => Promise<Answer>>(() => Promise.resolve(SIGNED_IN)),
    updateUser: vi.fn<(c: unknown) => Promise<Answer>>(() =>
      Promise.resolve({ data: {}, error: null }),
    ),
    onAuthStateChange: vi.fn((cb: typeof callback) => {
      callback = cb
      return { data: { subscription: { unsubscribe } } }
    }),
  }

  // The chain the profile read uses: from().select().eq().single().
  const query = {
    select: () => query,
    eq: () => query,
    // Wait for the hold (if any), then answer.
    single: () =>
      (profile.holds.shift() ?? profile.hold ?? Promise.resolve()).then(() => profile.answer),
  }
  const client = { auth, from: () => query } as unknown as SupabaseClient

  return {
    client,
    auth,
    rememberStorage,
    profile,
    unsubscribe,
    /** Pretends Supabase reported a change. */
    emit: (event: AuthChangeEvent, session: SupabaseSession | null) => {
      callback?.(event, session)
    },
  }
}
