/**
 * A test double for the table side of the Supabase client: `from(table).select().eq()…`. It
 * records every call, and answers each finished query through a handler the test supplies, so a
 * test can check both what the service asked for and how it copes with the answer. Used only by
 * tests.
 */

// The client type the double stands in for.
import type { SupabaseClient } from '@supabase/supabase-js'

/** What a finished query answers with. */
export interface TableAnswer {
  data: unknown
  error: unknown
  // The row count a query asked for with `{ count: 'exact' }`.
  count?: number | null
}

/** One call made on a query, such as `['eq', 'id', '123']`. */
export type RecordedCall = [method: string, ...args: unknown[]]

/** A finished query: the table and every call made on it, in order. */
export interface RecordedQuery {
  table: string
  calls: RecordedCall[]
}

/** True when `query` made a call to `method` with exactly these arguments. */
export function made(query: RecordedQuery, method: string, ...args: unknown[]): boolean {
  // Compare the whole call, method first.
  return query.calls.some(
    (call) => call[0] === method && JSON.stringify(call.slice(1)) === JSON.stringify(args),
  )
}

/** The chainable methods the services use. */
const CHAIN = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'in',
  'is',
  'not',
  'or',
  'order',
  'limit',
  'range',
  'maybeSingle',
  'single',
] as const

/** A query being built. It can be awaited, like the real one. */
class FakeQuery implements PromiseLike<TableAnswer> {
  // What has been called so far.
  private readonly recorded: RecordedQuery
  // Where finished queries are listed for the test.
  private readonly finished: RecordedQuery[]
  // How this query is answered.
  private readonly answer: (query: RecordedQuery) => TableAnswer | Promise<TableAnswer>

  constructor(
    table: string,
    answer: (query: RecordedQuery) => TableAnswer | Promise<TableAnswer>,
    finished: RecordedQuery[],
  ) {
    this.recorded = { table, calls: [] }
    this.finished = finished
    this.answer = answer
    // Every chain method records itself and returns this query.
    for (const method of CHAIN) {
      Object.defineProperty(this, method, {
        value: (...args: unknown[]) => {
          this.recorded.calls.push([method, ...args])
          return this
        },
      })
    }
  }

  /** Records the arguments of a function call, which has no chain of its own. */
  recordRpc(args: unknown) {
    this.recorded.calls.push(['rpc', args])
  }

  // Awaiting the query answers it.
  then<A = TableAnswer, B = never>(
    onfulfilled?: ((value: TableAnswer) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    // Remember the finished query, so the test can inspect it.
    this.finished.push(this.recorded)
    return Promise.resolve(this.answer(this.recorded)).then(onfulfilled, onrejected)
  }
}

/**
 * Builds a client whose tables answer through `answer`, and the list of queries it saw. When
 * `userId` is given, `auth.getSession()` reports that person as signed in; otherwise nobody is.
 */
export function createFakeTables(
  answer: (query: RecordedQuery) => TableAnswer | Promise<TableAnswer>,
  { userId }: { userId?: string } = {},
) {
  // Every query that was awaited, in order.
  const queries: RecordedQuery[] = []
  const client = {
    from: (table: string) => new FakeQuery(table, answer, queries),
    // A function call is recorded as a query on "rpc:name" whose only call is its arguments.
    rpc: (name: string, args: unknown) => {
      const query = new FakeQuery(`rpc:${name}`, answer, queries)
      query.recordRpc(args)
      return query
    },
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: userId === undefined ? null : { user: { id: userId } } },
          error: null,
        }),
    },
  } as unknown as SupabaseClient
  return { client, queries }
}
