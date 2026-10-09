/**
 * Tests for saving and restoring the demo platform's changes.
 */

// Vitest building blocks.
import { beforeEach, describe, expect, it } from 'vitest'

// Records to build a platform from.
import { classRecord, courseRecord, emptyPlatformData, summaryRecord } from '../platformData'

// The unit under test.
import { loadPlatform, PLATFORM_KEY, savePlatform } from './platformStore'

/** A seed with one summary in review. */
function seed() {
  return emptyPlatformData({
    courses: [courseRecord({ id: 'c1', teacherId: 't1' })],
    classes: [classRecord({ id: 'k1', courseId: 'c1' })],
    summaries: [
      summaryRecord({
        id: 's1',
        classId: 'k1',
        status: 'in_review',
        inReviewSince: '2026-10-07T12:00:00.000Z',
      }),
    ],
  })
}

describe('platformStore', () => {
  // Start every test with empty storage.
  beforeEach(() => {
    window.localStorage.clear()
  })

  // Proves nothing saved gives the seed unchanged.
  it('returns the seed when nothing is saved', () => {
    const data = seed()
    expect(loadPlatform(window.localStorage, data)).toBe(data)
  })

  // Proves a saved edit and a saved publish come back after a reload.
  it('restores saved changes over the seed', () => {
    const changed = seed()
    const summary = changed.summaries[0]!
    summary.status = 'published'
    summary.publishedAt = '2026-10-12T10:00:00.000Z'
    summary.reviewedBy = 't1'
    summary.version = 3
    summary.draft = { ...summary.draft, overview: 'Edited.' }
    savePlatform(window.localStorage, changed)

    const restored = loadPlatform(window.localStorage, seed()).summaries[0]!
    expect(restored).toMatchObject({
      status: 'published',
      publishedAt: '2026-10-12T10:00:00.000Z',
      reviewedBy: 't1',
      version: 3,
      draft: { overview: 'Edited.' },
    })
    // What was not saved still comes from the seed.
    expect(restored.classId).toBe('k1')
  })

  // SECURITY: proves a hand-edited save that doesn't match the shape, or isn't JSON, is thrown
  // away instead of trusted.
  it.each([
    ['not JSON', '{nope'],
    ['a wrong status', JSON.stringify({ summaries: [{ id: 's1', status: 'approved' }] })],
    ['no summaries', JSON.stringify({})],
  ])('ignores a save that is %s', (_name, raw) => {
    window.localStorage.setItem(PLATFORM_KEY, raw)
    const data = seed()
    expect(loadPlatform(window.localStorage, data)).toBe(data)
  })

  // SECURITY: proves a saved summary the seed doesn't have is ignored, so storage can't add one.
  it('ignores a saved summary that is not in the seed', () => {
    const extra = seed()
    extra.summaries.push(summaryRecord({ id: 'ghost', classId: 'k1', status: 'published' }))
    savePlatform(window.localStorage, extra)

    expect(loadPlatform(window.localStorage, seed()).summaries.map((s) => s.id)).toEqual(['s1'])
  })
})
