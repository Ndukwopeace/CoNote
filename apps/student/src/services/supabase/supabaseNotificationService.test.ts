/**
 * Tests for the student's notification service: that it is the shared reader, given the student
 * app's address. The reading, marking and link rules are tested once, in the shared package.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The fake client.
import { createFakeTables } from '@conote/testing/fakeTables'

// The service under test.
import { createSupabaseNotificationService } from './supabaseNotificationService'

describe('Supabase notification service (student)', () => {
  // Proves the service reads the notifications table and keeps a link inside the student app.
  it('lists notifications and judges links by the student app address', async () => {
    const { client, queries } = createFakeTables(() => ({
      data: [
        {
          id: '70000000-0000-0000-0000-000000000001',
          type: 'summary',
          title: 'Summary published',
          body: 'Dr. Okeke published the summary.',
          link: '/courses/c1/classes/k1/summary',
          created_at: '2026-10-02T09:00:00+00:00',
          read: false,
        },
        {
          id: '70000000-0000-0000-0000-000000000002',
          type: 'summary',
          title: 'Elsewhere',
          body: '',
          link: 'https://evil.example/x',
          created_at: '2026-10-02T08:00:00+00:00',
          read: false,
        },
      ],
      error: null,
    }))
    const service = createSupabaseNotificationService({ client, origin: 'https://app.example' })

    const list = await service.list()

    expect(queries[0]!.table).toBe('notifications')
    expect(list[0]).toMatchObject({ link: '/courses/c1/classes/k1/summary' })
    expect(list[1]).not.toHaveProperty('link')
  })
})
