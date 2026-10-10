/**
 * Tests for the Supabase notification service against a fake client.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The fake client, and the helper that checks what was asked.
import {
  createFakeTables,
  made,
  type RecordedQuery,
  type TableAnswer,
} from '@conote/testing/fakeTables'

// The service under test.
import { createSupabaseNotificationService } from './supabaseNotificationService'

// Made-up IDs, shaped like the database's.
const FIRST = '70000000-0000-0000-0000-000000000001'
const SECOND = '70000000-0000-0000-0000-000000000002'

/** A notification row as the database returns it. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: FIRST,
    type: 'summary',
    title: 'New summary',
    body: 'Your teacher approved it.',
    link: '/classes/c1',
    created_at: '2026-10-02T09:00:00+00:00',
    read: false,
    ...overrides,
  }
}

/** What each kind of call answers. */
interface Answers {
  read: TableAnswer
  write: TableAnswer
}

/** Builds the service over a fake client that answers from `answers`. */
function setup(overrides: Partial<Answers> = {}) {
  const answers: Answers = {
    read: { data: [row()], error: null },
    write: { data: [{ id: FIRST }], error: null },
    ...overrides,
  }
  const { client, queries } = createFakeTables((query: RecordedQuery) => {
    if (query.table !== 'notifications') throw new Error(`Unexpected table ${query.table}`)
    return query.calls.some(([name]) => name === 'update') ? answers.write : answers.read
  })
  return {
    service: createSupabaseNotificationService({ client, origin: 'https://app.example' }),
    queries,
  }
}

describe('Supabase notification service: reading', () => {
  // Proves rows become notifications, newest first, with a missing link left out.
  it('lists notifications, newest first', async () => {
    const { service, queries } = setup({
      read: { data: [row(), row({ id: SECOND, link: null, read: true })], error: null },
    })

    const list = await service.list()

    expect(list[0]).toEqual({
      id: FIRST,
      type: 'summary',
      title: 'New summary',
      body: 'Your teacher approved it.',
      link: '/classes/c1',
      createdAt: '2026-10-02T09:00:00+00:00',
      read: false,
    })
    expect(list[1]).not.toHaveProperty('link')
    expect(made(queries[0]!, 'order', 'created_at', { ascending: false })).toBe(true)
  })

  // SECURITY: proves a link that leaves the app (or could run code) is dropped, not followed.
  it.each(['https://evil.example/x', 'javascript:alert(1)', '//evil.example', '/\\evil.example'])(
    'drops the link %s',
    async (link) => {
      const { service } = setup({ read: { data: [row({ link })], error: null } })

      const [notification] = await service.list()

      expect(notification).not.toHaveProperty('link')
    },
  )

  // Proves the unread count asks only for unread notifications.
  it('counts the unread notifications', async () => {
    const { service, queries } = setup({
      read: { data: [{ id: FIRST }, { id: SECOND }], error: null },
    })

    await expect(service.unreadCount()).resolves.toBe(2)
    expect(made(queries[0]!, 'eq', 'read', false)).toBe(true)
  })

  // Proves refusals and malformed rows become AppErrors.
  it('turns refusals and malformed rows into AppErrors', async () => {
    const refused = setup({ read: { data: null, error: { code: '42501', message: 'denied' } } })
    await expect(refused.service.list()).rejects.toMatchObject({ kind: 'forbidden' })

    const malformed = setup({ read: { data: [row({ type: 'spam' })], error: null } })
    await expect(malformed.service.list()).rejects.toMatchObject({ kind: 'unknown' })
  })
})

describe('Supabase notification service: marking read', () => {
  // Proves one notification is marked read by ID, with nothing else changed.
  it('marks one notification as read', async () => {
    const { service, queries } = setup()

    await expect(service.markRead(FIRST)).resolves.toBeUndefined()

    const write = queries[0]!
    expect(made(write, 'update', { read: true })).toBe(true)
    expect(made(write, 'eq', 'id', FIRST)).toBe(true)
  })

  // Proves a notification that is not the student's reads as not_found.
  it('reports a notification that changes nothing as not_found', async () => {
    const { service } = setup({ write: { data: [], error: null } })

    await expect(service.markRead(FIRST)).rejects.toMatchObject({ kind: 'not_found' })
  })

  // SECURITY: proves an ID that is not a UUID never reaches a query.
  it('refuses an ID that is not a UUID without asking the database', async () => {
    const { service, queries } = setup()

    await expect(service.markRead('no-such-notification')).rejects.toMatchObject({
      kind: 'not_found',
    })
    expect(queries).toHaveLength(0)
  })

  // Proves "mark all" changes only the unread ones.
  it('marks every unread notification as read', async () => {
    const { service, queries } = setup()

    await expect(service.markAllRead()).resolves.toBeUndefined()

    const write = queries[0]!
    expect(made(write, 'update', { read: true })).toBe(true)
    expect(made(write, 'eq', 'read', false)).toBe(true)
  })
})
