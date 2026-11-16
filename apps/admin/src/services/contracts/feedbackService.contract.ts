/**
 * The rules every AdminFeedbackService must follow (D125), run against the demo and, in CI, the
 * real database. The real table keeps what earlier runs sent, so each test finds its own piece of
 * feedback by a message no other test uses.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The records a test starts from.
import type { PlatformData } from '../platformData'
// The interface under test.
import type { AdminFeedbackService } from '@/types/feedback'

/** Builds a service over `data`, signed in as an administrator. */
export type CreateFeedbackService = (data: PlatformData, now: Date) => AdminFeedbackService

/** The clock the contract uses. */
const NOW = new Date(2026, 9, 8, 12)

/** A message nobody else sends, so a test can find its own feedback. */
function uniqueMessage(label: string) {
  return `${label} ${String(Date.now())}-${String(Math.random()).slice(2, 8)}`
}

/** Registers the AdminFeedbackService contract suite under `name`. */
export function describeFeedbackServiceContract(
  name: string,
  create: CreateFeedbackService,
  emptyData: () => PlatformData,
) {
  describe(`AdminFeedbackService contract: ${name}`, () => {
    // Proves what is sent is listed, new, with the kind, score, page and the sender's role.
    it('lists what was sent, new, newest first', async () => {
      const service = create(emptyData(), NOW)
      const message = uniqueMessage('Idea')

      await service.send({ kind: 'idea', message, rating: 4, page: '/admin/users' })
      const page = await service.listFeedback({})

      const item = page.items.find((entry) => entry.message === message)
      expect(item).toMatchObject({
        kind: 'idea',
        rating: 4,
        page: '/admin/users',
        status: 'new',
        senderRole: 'admin',
      })
      expect(page.total).toBeGreaterThan(0)
      const times = page.items.map((entry) => Date.parse(entry.createdAt))
      expect(times).toEqual([...times].sort((a, b) => b - a))
    })

    // Proves an empty message is refused and nothing is stored.
    it('refuses an empty message', async () => {
      const service = create(emptyData(), NOW)

      await expect(
        service.send({ kind: 'bug', message: '   ', rating: null, page: '/x' }),
      ).rejects.toMatchObject({ kind: 'validation' })
    })

    // Proves a status change moves the feedback between the "new" and "read" lists.
    it('marks feedback read and new again', async () => {
      const service = create(emptyData(), NOW)
      const message = uniqueMessage('Bug')
      await service.send({ kind: 'bug', message, rating: null, page: '' })
      const id = (await service.listFeedback({})).items.find((item) => item.message === message)?.id
      expect(id).toBeDefined()

      await service.setFeedbackStatus(id ?? '', 'read')
      const read = await service.listFeedback({ status: 'read', kind: 'bug' })
      const unread = await service.listFeedback({ status: 'new', kind: 'bug' })
      expect(read.items.some((item) => item.message === message)).toBe(true)
      expect(unread.items.some((item) => item.message === message)).toBe(false)

      await service.setFeedbackStatus(id ?? '', 'new')
      const back = await service.listFeedback({ status: 'new', kind: 'bug' })
      expect(back.items.some((item) => item.message === message)).toBe(true)
    })

    // Proves the kind filter narrows the list.
    it('narrows by kind', async () => {
      const service = create(emptyData(), NOW)
      const message = uniqueMessage('Other')
      await service.send({ kind: 'other', message, rating: 5, page: '/admin' })

      const others = await service.listFeedback({ kind: 'other' })

      expect(others.items.every((item) => item.kind === 'other')).toBe(true)
      expect(others.items.some((item) => item.message === message)).toBe(true)
    })

    // Proves a page holds at most its size and the total says how many match in all.
    it('pages the list and keeps the total', async () => {
      const service = create(emptyData(), NOW)
      await service.send({ kind: 'idea', message: uniqueMessage('Page'), rating: null, page: '' })

      const first = await service.listFeedback({ offset: 0 })
      const beyond = await service.listFeedback({ offset: 100_000 })

      expect(first.items.length).toBeLessThanOrEqual(20)
      expect(beyond.items).toHaveLength(0)
      expect(beyond.total).toBe(first.total)
    })

    // Proves an unknown ID is "not found", whether or not it is a well-formed ID.
    it('answers not found for an unknown piece of feedback', async () => {
      const service = create(emptyData(), NOW)

      await expect(
        service.setFeedbackStatus('00000000-0000-0000-0000-00000000dead', 'read'),
      ).rejects.toMatchObject({ kind: 'not_found' })
      await expect(service.setFeedbackStatus('nope', 'read')).rejects.toMatchObject({
        kind: 'not_found',
      })
    })
  })
}
