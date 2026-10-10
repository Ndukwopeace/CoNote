/**
 * Tests for the Supabase profile service against a fake client: what it reads and writes, the
 * rules it applies itself, and how it copes with a signed-out visitor and bad rows.
 */

// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The fake client, and the helper that checks what was asked.
import {
  createFakeTables,
  made,
  type RecordedQuery,
  type TableAnswer,
} from '@conote/testing/fakeTables'

// The service under test.
import { createSupabaseProfileService } from './supabaseProfileService'

// A made-up ID, shaped like the database's.
const ME = '10000000-0000-0000-0000-000000000004'

/** A profile row as the database returns it. */
function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ME,
    role: 'student',
    full_name: 'Victory Eze',
    email: 'student@conote.example',
    avatar_url: null,
    department: 'Computer Science',
    level: null,
    phone: null,
    notification_prefs: {},
    ...overrides,
  }
}

/** What each kind of call answers. */
interface Answers {
  read: TableAnswer
  write: TableAnswer
}

/** Builds the service over a fake client that answers from `answers`. */
function setup(options: { answers?: Partial<Answers>; userId?: string | undefined } = {}) {
  const answers: Answers = {
    read: { data: profileRow(), error: null },
    write: { data: profileRow(), error: null },
    ...options.answers,
  }
  const { client, queries } = createFakeTables(
    (query: RecordedQuery) => {
      if (query.table !== 'profiles') throw new Error(`Unexpected table ${query.table}`)
      return query.calls.some(([name]) => name === 'update') ? answers.write : answers.read
    },
    // An explicit `userId: undefined` means signed out; leaving it out means signed in as ME.
    'userId' in options ? { userId: options.userId! } : { userId: ME },
  )
  const afterNameChange = vi.fn<() => Promise<void>>(() => Promise.resolve())
  return {
    service: createSupabaseProfileService({ client, afterNameChange }),
    queries,
    afterNameChange,
  }
}

describe('Supabase profile service: reading', () => {
  // Proves the row becomes the profile the page shows, with defaults for what was never set.
  it('reads the signed-in student', async () => {
    const { service, queries } = setup()

    const me = await service.getMe()

    expect(me).toEqual({
      id: ME,
      role: 'student',
      fullName: 'Victory Eze',
      email: 'student@conote.example',
      department: 'Computer Science',
      notificationPrefs: {
        summaryPublished: { inApp: true, email: true },
        classReminders: { inApp: true, email: false },
        announcements: { inApp: true, email: true },
      },
    })
    expect(made(queries[0]!, 'eq', 'id', ME)).toBe(true)
  })

  // Proves saved settings and a picture address are returned when present.
  it('returns saved settings and a picture', async () => {
    const prefs = {
      summaryPublished: { inApp: false, email: false },
      classReminders: { inApp: false, email: true },
      announcements: { inApp: true, email: false },
    }
    const { service } = setup({
      answers: {
        read: {
          data: profileRow({ notification_prefs: prefs, avatar_url: 'https://cdn.example/a.png' }),
          error: null,
        },
      },
    })

    const me = await service.getMe()

    expect(me.notificationPrefs).toEqual(prefs)
    expect(me.avatarUrl).toBe('https://cdn.example/a.png')
  })

  // Proves settings the app does not recognise fall back to the defaults instead of breaking.
  it('falls back to default settings for a value of the wrong shape', async () => {
    const { service } = setup({
      answers: {
        read: { data: profileRow({ notification_prefs: { summaryPublished: 1 } }), error: null },
      },
    })

    const me = await service.getMe()

    expect(me.notificationPrefs.summaryPublished).toEqual({ inApp: true, email: true })
  })

  // Proves a signed-out visitor is unauthorized, with no query made.
  it('reports a signed-out visitor as unauthorized', async () => {
    const { service, queries } = setup({ userId: undefined })

    await expect(service.getMe()).rejects.toMatchObject({ kind: 'unauthorized' })
    await expect(service.updateMe({ level: '300' })).rejects.toMatchObject({ kind: 'unauthorized' })
    expect(queries).toHaveLength(0)
  })

  // Proves a missing row is not_found, and a malformed one is refused.
  it('refuses a missing or malformed profile row', async () => {
    const missing = setup({ answers: { read: { data: null, error: null } } })
    await expect(missing.service.getMe()).rejects.toMatchObject({ kind: 'not_found' })

    const malformed = setup({
      answers: { read: { data: profileRow({ role: 'wizard' }), error: null } },
    })
    await expect(malformed.service.getMe()).rejects.toMatchObject({ kind: 'unknown' })
  })
})

describe('Supabase profile service: writing', () => {
  // Proves only the fields given are written, trimmed, with blank optional text stored as null.
  it('writes only the fields it is given', async () => {
    const { service, queries } = setup()

    await service.updateMe({ department: ' Physics ', phone: '' })

    const write = queries.find((q) => q.calls.some(([name]) => name === 'update'))!
    expect(made(write, 'update', { department: 'Physics', phone: null })).toBe(true)
    expect(made(write, 'eq', 'id', ME)).toBe(true)
  })

  // Proves a rename is announced, so the navigation shows the new name straight away.
  it('tells the session about a new name', async () => {
    const { service, queries, afterNameChange } = setup()

    await service.updateMe({ fullName: '  Ada Lovelace ' })

    const write = queries.find((q) => q.calls.some(([name]) => name === 'update'))!
    expect(made(write, 'update', { full_name: 'Ada Lovelace' })).toBe(true)
    expect(afterNameChange).toHaveBeenCalledOnce()
  })

  // Proves a change that is not a rename does not disturb the session.
  it('leaves the session alone when the name is unchanged', async () => {
    const { service, afterNameChange } = setup()

    await service.updateMe({ level: '300' })

    expect(afterNameChange).not.toHaveBeenCalled()
  })

  // Proves a failure to refresh the session does not undo or fail the save.
  it('still saves when the session refresh fails', async () => {
    const { service, afterNameChange } = setup()
    afterNameChange.mockRejectedValueOnce(new Error('offline'))

    await expect(service.updateMe({ fullName: 'Ada Lovelace' })).resolves.toMatchObject({ id: ME })
  })

  // Proves settings are written as the database's JSON column.
  it('writes notification settings', async () => {
    const { service, queries } = setup()
    const prefs = {
      summaryPublished: { inApp: false, email: false },
      classReminders: { inApp: true, email: true },
      announcements: { inApp: false, email: true },
    }

    await service.updateMe({ notificationPrefs: prefs })

    const write = queries.find((q) => q.calls.some(([name]) => name === 'update'))!
    expect(made(write, 'update', { notification_prefs: prefs })).toBe(true)
  })

  // Proves nothing is written when there is nothing to change.
  it('writes nothing for an empty change', async () => {
    const { service, queries } = setup()

    await service.updateMe({})

    expect(queries.some((q) => q.calls.some(([name]) => name === 'update'))).toBe(false)
  })

  // SECURITY: proves the profile rules are applied before anything is sent.
  it.each([
    ['an empty name', { fullName: '  ' }],
    ['a long department', { department: 'd'.repeat(81) }],
    ['a phone with letters', { phone: 'abc' }],
    ['settings of the wrong shape', { notificationPrefs: { announcements: true } }],
    ['a picture address', { avatarUrl: 'https://cdn.example/a.png' }],
  ])('rejects %s before asking the database', async (_label, changes) => {
    const { service, queries } = setup()

    await expect(
      service.updateMe(changes as Parameters<typeof service.updateMe>[0]),
    ).rejects.toMatchObject({ kind: 'validation' })
    expect(queries).toHaveLength(0)
  })

  // Proves a refused write is an AppError.
  it('turns a refused write into an AppError', async () => {
    const { service } = setup({
      answers: { write: { data: null, error: { code: '42501', message: 'denied' } } },
    })

    await expect(service.updateMe({ level: '300' })).rejects.toMatchObject({ kind: 'forbidden' })
  })
})

describe('Supabase profile service: pictures', () => {
  // SECURITY: proves the picture rules are applied before anything is sent.
  it('refuses a picture of the wrong type or size', async () => {
    const { service, queries } = setup()

    await expect(
      service.uploadAvatar(new File([new Uint8Array(10)], 'a', { type: 'image/svg+xml' })),
    ).rejects.toMatchObject({ kind: 'validation' })
    await expect(
      service.uploadAvatar(
        new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'a', { type: 'image/png' }),
      ),
    ).rejects.toMatchObject({ kind: 'validation' })
    expect(queries).toHaveLength(0)
  })

  // Proves a valid picture is refused with a clear message until file storage is connected.
  it('says pictures are not available yet', async () => {
    const { service } = setup()

    await expect(
      service.uploadAvatar(new File([new Uint8Array(10)], 'a', { type: 'image/png' })),
    ).rejects.toMatchObject({
      kind: 'validation',
      message: "Profile pictures aren't available yet.",
    })
  })
})
