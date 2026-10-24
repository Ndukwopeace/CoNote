/**
 * Tests for the teacher's notification service: that it is the shared reader, given the teacher
 * portal's address. The reading, marking and link rules are tested once, in the shared package.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The fake client.
import { createFakeTables } from '@conote/testing/fakeTables'

// The service under test.
import { createSupabaseNotificationService } from './supabaseNotificationService'

/** A notice row as the database returns it. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: '70000000-0000-0000-0000-000000000001',
    type: 'summary',
    title: 'A draft is ready to review',
    body: 'MTH 202, class 4: Basis and dimension',
    link: '/teacher/reviews/30000000-0000-4000-8000-000000000001',
    created_at: '2026-10-02T09:00:00+00:00',
    read: false,
    ...overrides,
  }
}

describe('Supabase notification service (teacher)', () => {
  // Proves the service reads the notifications table and keeps the link to the draft.
  it('lists the notices of the teacher and keeps the link to the draft', async () => {
    const { client, queries } = createFakeTables(() => ({ data: [row()], error: null }))
    const service = createSupabaseNotificationService({ client, origin: 'https://teacher.example' })

    const [notice] = await service.list()

    expect(queries[0]!.table).toBe('notifications')
    expect(notice).toMatchObject({
      title: 'A draft is ready to review',
      link: '/teacher/reviews/30000000-0000-4000-8000-000000000001',
      read: false,
    })
  })

  // SECURITY: proves a link that leaves the portal is dropped, not followed.
  it('drops a link that leads outside the portal', async () => {
    const { client } = createFakeTables(() => ({
      data: [row({ link: 'https://evil.example/x' })],
      error: null,
    }))
    const service = createSupabaseNotificationService({ client, origin: 'https://teacher.example' })

    const [notice] = await service.list()

    expect(notice).not.toHaveProperty('link')
  })
})
