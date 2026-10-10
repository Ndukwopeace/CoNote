/**
 * What the functions' tests share: stand-ins for the two Supabase clients, and a way to call a
 * handler the way Supabase would. Used only by tests.
 */

// The client type the stand-ins pretend to be.
import type { SupabaseClient } from '@supabase/supabase-js'
import { vi } from 'vitest'

// The table double and the helper that asks what a query did.
import { createFakeTables, type RecordedQuery, type TableAnswer } from '@conote/testing/fakeTables'

// The pieces under test.
import type { FunctionDeps } from './_shared/admin.ts'
import type { Clients } from './_shared/clients.ts'
import { readEnv } from './_shared/env.ts'

// IDs the tests use. They are version-4 UUIDs, which is what Supabase makes.
export const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
export const OTHER_ID = '22222222-2222-4222-8222-222222222222'
export const NEW_ID = '33333333-3333-4333-8333-333333333333'

/** The settings, as the functions read them. */
export const ENV = readEnv(
  (name) =>
    ({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      APP_URL_STUDENT: 'https://app.example/',
      APP_URL_TEACHER: 'https://teacher.example',
      APP_URL_ADMIN: 'https://admin.example',
    })[name],
)

/** The fixed time the tests run at. */
export const NOW = new Date('2026-10-08T12:00:00.000Z')

/** A request to a function, as the console sends it. */
export function post(body: unknown, token: string | null = 'good-token', method = 'POST'): Request {
  // A string is sent as it is (so a test can send broken JSON); anything else as JSON.
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request('https://project.supabase.co/functions/v1/x', {
    method,
    headers: token === null ? {} : { Authorization: `Bearer ${token}` },
    body: method === 'POST' ? text : null,
  })
}

/** What a test can steer. */
export interface Setup {
  // Answers each query on the server-key client.
  answer: (query: RecordedQuery) => TableAnswer
  // Who the token belongs to (null: nobody).
  caller?: string | null
}

/** Stand-ins for the clients, and the handles to check what was done. */
export function setupFunction({ answer, caller = ADMIN_ID }: Setup) {
  const tables = createFakeTables(answer)
  const admin = {
    createUser: vi.fn<(attributes: unknown) => Promise<{ data: unknown; error: unknown }>>(() =>
      Promise.resolve({ data: { user: { id: NEW_ID } }, error: null }),
    ),
    deleteUser: vi.fn<(id: string) => Promise<{ data: unknown; error: unknown }>>(() =>
      Promise.resolve({ data: {}, error: null }),
    ),
    updateUserById: vi.fn<
      (id: string, attributes: unknown) => Promise<{ data: unknown; error: unknown }>
    >(() => Promise.resolve({ data: {}, error: null })),
  }
  const resetPasswordForEmail = vi.fn<
    (email: string, options: unknown) => Promise<{ data: unknown; error: unknown }>
  >(() => Promise.resolve({ data: {}, error: null }))
  const listBuckets = vi.fn<() => Promise<{ data: unknown; error: unknown }>>(() =>
    Promise.resolve({ data: [], error: null }),
  )
  const listUsers = vi.fn<(options: unknown) => Promise<{ data: unknown; error: unknown }>>(() =>
    Promise.resolve({ data: { users: [] }, error: null }),
  )
  const service = {
    from: (table: string) => tables.client.from(table),
    auth: { admin: { ...admin, listUsers } },
    storage: { listBuckets },
  } as unknown as SupabaseClient
  const anon = { auth: { resetPasswordForEmail } } as unknown as SupabaseClient
  const clients: Clients = { service, anon, callerId: () => Promise.resolve(caller) }
  const deps: FunctionDeps = { env: ENV, clients, now: () => NOW }
  return { deps, admin, listUsers, listBuckets, resetPasswordForEmail, queries: tables.queries }
}

/** The JSON a response carries. */
export async function bodyOf(response: Response): Promise<unknown> {
  return response.json()
}

/** A profile row for the caller or the account acted on. */
export const profile = (overrides: Record<string, unknown> = {}) => ({
  role: 'admin',
  status: 'active',
  ...overrides,
})

/** The first data-changing call on a query, or "select" when it only reads. */
function actionOf(query: RecordedQuery): string {
  const change = query.calls.find((call) =>
    ['insert', 'update', 'upsert', 'delete'].includes(call[0]),
  )
  return change?.[0] ?? 'select'
}

/**
 * An answer function that routes by table and action. The caller's own profile read is answered
 * as an active administrator unless `caller` is given. `routes` is keyed like "profiles:update".
 */
export function route(
  routes: Record<string, TableAnswer>,
  caller?: TableAnswer,
): (query: RecordedQuery) => TableAnswer {
  return (query) => {
    // The caller's profile is the read that filters on the administrator's own ID.
    if (
      query.table === 'profiles' &&
      query.calls.some((call) => call[0] === 'eq' && call[1] === 'id' && call[2] === ADMIN_ID)
    ) {
      // An active administrator unless the test says otherwise.
      return caller ?? { data: profile(), error: null }
    }
    return routes[`${query.table}:${actionOf(query)}`] ?? { data: [], error: null }
  }
}

/** The data passed to the first call named `method` on the first query of `table`. */
export function sentTo(queries: RecordedQuery[], table: string, method: string): unknown {
  const query = queries.find(
    (candidate) => candidate.table === table && candidate.calls.some((call) => call[0] === method),
  )
  return query?.calls.find((call) => call[0] === method)?.[1]
}
