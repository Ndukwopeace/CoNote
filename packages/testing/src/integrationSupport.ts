/**
 * What the real-backend tests of every app share: reading their settings, the check that the stack
 * is local, short IDs ("c1", "t1") translated to the UUIDs the database uses, and signed-in
 * clients. Each app's harness extends `StackHarness` with the loading of its own platform records.
 * Used only by tests that run against the throwaway local stack (the last step of the "Supabase
 * contract tests" job); never import it from app code.
 *
 * SECURITY: loading a platform EMPTIES the stack's accounts and courses, so the harness refuses to
 * run against anything but a local address.
 */

// The SDK, to talk to the stack as the server and as a signed-in person.
import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js'

/** The stack to test against. Each field is undefined when its variable is missing or empty. */
export interface StackSettings {
  url: string | undefined
  anonKey: string | undefined
  serviceKey: string | undefined
  // True when every setting the suites need is present; otherwise they are skipped.
  configured: boolean
}

/** A setting from `env` (the app's `import.meta.env`), or undefined when missing or empty. */
function setting(env: Record<string, unknown>, name: string): string | undefined {
  const value = env[name]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Reads the stack's address and keys from `env`. Vitest exposes only VITE_-prefixed variables. */
export function readStackSettings(env: Record<string, unknown>): StackSettings {
  const url = setting(env, 'VITE_SUPABASE_TEST_URL')
  const anonKey = setting(env, 'VITE_SUPABASE_TEST_ANON_KEY')
  const serviceKey = setting(env, 'VITE_SUPABASE_TEST_SERVICE_KEY')
  return { url, anonKey, serviceKey, configured: Boolean(url && anonKey && serviceKey) }
}

/** Storage that lives only in memory, so tests never touch the browser's. */
export function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
    removeItem: (key: string) => {
      items.delete(key)
    },
  }
}

/** Throws unless a refused write to Supabase was none. */
export function ok(result: { error: { message: string } | null }, what: string) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`)
}

/** True for a plain object, so its fields can be walked. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The short IDs a contract uses, and the UUIDs the database knows them by. */
export class IdMap {
  private readonly toUuid = new Map<string, string>()
  private readonly toShort = new Map<string, string>()

  /** The UUID for `short`, made the first time it is asked for. */
  uuid(short: string): string {
    let id = this.toUuid.get(short)
    if (id === undefined) {
      id = crypto.randomUUID()
      this.set(short, id)
    }
    return id
  }

  /** Records that `short` is the database's `id`. */
  set(short: string, id: string) {
    this.toUuid.set(short, id)
    this.toShort.set(id, short)
  }

  /** `value` with every known short ID replaced by its UUID, however deep. */
  down<T>(value: T): T {
    return this.walk(value, this.toUuid) as T
  }

  /** `value` with every known UUID replaced by its short ID, however deep. */
  up<T>(value: T): T {
    return this.walk(value, this.toShort) as T
  }

  /** Copies `value`, swapping each string found in `table`. */
  private walk(value: unknown, table: Map<string, string>): unknown {
    if (typeof value === 'string') return table.get(value) ?? value
    if (Array.isArray(value)) return value.map((item) => this.walk(item, table))
    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.walk(item, table)]),
      )
    }
    return value
  }
}

/** A client with the server key, which bypasses Row Level Security. */
function serverClient(settings: StackSettings): SupabaseClient {
  const options: SupabaseClientOptions<'public'> = { auth: { persistSession: false } }
  // Typed through a variable: the SDK's generic parameters differ between its own signatures.
  const client = createClient(settings.url ?? '', settings.serviceKey ?? '', options)
  return client
}

/** A client with the public key, which acts as whoever signs in on it. */
function publicClient(settings: StackSettings, short: string): SupabaseClient {
  const options: SupabaseClientOptions<'public'> = {
    auth: { storage: memoryStorage(), storageKey: `harness-${short}`, autoRefreshToken: false },
  }
  const client = createClient(settings.url ?? '', settings.anonKey ?? '', options)
  return client
}

/** The password every account the harness creates gets. */
const PASSWORD = `Harness-${Math.random().toString(36).slice(2, 10)}-2026`

/** The part of an account the harness needs to create it and sign in as it. */
export interface HarnessAccount {
  id: string
  email: string
}

/** How a harness treats the accounts between one load and the next. */
export interface HarnessOptions {
  // True: every load starts from no accounts at all, with new IDs, so what one test did to an
  // account (and what the audit log recorded about it) cannot reach the next. False: the accounts
  // are made once and reused, which is much faster.
  freshAccounts?: boolean
}

/** Loads contract platforms into the stack and builds clients for them. */
export abstract class StackHarness<D extends { users: HarnessAccount[] }> {
  ids = new IdMap()
  // A client with the server key, which bypasses Row Level Security.
  protected readonly server: SupabaseClient
  // People already signed in, by short ID.
  private readonly clients = new Map<string, SupabaseClient>()
  private wiped = false
  private readonly freshAccounts: boolean
  // Where the stack is and how to reach it.
  protected readonly settings: StackSettings

  constructor(settings: StackSettings, { freshAccounts = false }: HarnessOptions = {}) {
    this.settings = settings
    this.server = serverClient(settings)
    this.freshAccounts = freshAccounts
  }

  /** Makes the stack hold exactly `data`'s records (and nothing else of the kinds it describes). */
  protected abstract load(data: D): Promise<void>

  /** Empties the stack's accounts and courses: once, or before every load when accounts are fresh. */
  protected async wipe() {
    if (this.wiped && !this.freshAccounts) return
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(this.settings.url ?? '')) {
      throw new Error('The harness empties the database; it runs only against a local stack.')
    }
    // Every course (classes, enrolments, requests, resources and summaries go with them).
    ok(
      await this.server.from('courses').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      'wipe courses',
    )
    // Every account (their profiles go with them).
    const listed = await this.server.auth.admin.listUsers({ perPage: 1000 })
    await Promise.all(listed.data.users.map((user) => this.server.auth.admin.deleteUser(user.id)))
    // New accounts get new IDs, and nobody is signed in.
    if (this.freshAccounts) {
      this.ids = new IdMap()
      this.clients.clear()
    }
    this.wiped = true
  }

  /** Creates the accounts of `users` that do not exist yet. */
  protected async ensureUsers(users: HarnessAccount[]) {
    await Promise.all(
      users
        .filter((user) => this.ids.down(user.id) === user.id)
        .map(async (user) => {
          const created = await this.server.auth.admin.createUser({
            email: user.email,
            password: PASSWORD,
            email_confirm: true,
          })
          const id = created.data.user?.id
          if (!id) throw new Error(`Could not create ${user.email}`)
          this.ids.set(user.id, id)
        }),
    )
  }

  /** A client signed in as the account `short`, or one with no session when it is empty. */
  async clientFor(short: string, data: D): Promise<SupabaseClient> {
    if (short === '') return publicClient(this.settings, short)
    const cached = this.clients.get(short)
    if (cached) return cached
    const client = publicClient(this.settings, short)
    const user = data.users.find((candidate) => candidate.id === short)
    if (!user) throw new Error(`The platform has no account ${short}`)
    const signedIn = await client.auth.signInWithPassword({ email: user.email, password: PASSWORD })
    if (signedIn.error) throw new Error(`Could not sign in as ${user.email}`)
    this.clients.set(short, client)
    return client
  }

  /**
   * Wraps a service so a contract can keep using its short IDs: arguments go down to UUIDs and
   * answers come back up to short IDs. The platform is loaded, and the service built, on the first
   * call, not when the wrapper is made: a contract may change `data` right after asking for the
   * service, and a service that is never called must not touch the database.
   */
  wrap<S extends object>(data: D, actorId: string, build: (client: SupabaseClient) => S): S {
    // Made on first use, then shared by every call.
    let ready: Promise<S> | undefined
    const start = () => {
      ready ??= (async () => {
        await this.load(data)
        return build(await this.clientFor(actorId, data))
      })()
      return ready
    }
    return new Proxy({} as S, {
      get: (_target, name) => {
        if (typeof name !== 'string') return undefined
        return async (...args: unknown[]) => {
          const service = (await start()) as Record<string, unknown>
          const method = service[name]
          if (typeof method !== 'function') throw new Error(`${name} is not a service method`)
          const result: unknown = await (method as (...a: unknown[]) => Promise<unknown>).apply(
            service,
            this.ids.down(args),
          )
          return this.ids.up(result)
        }
      },
    })
  }
}
