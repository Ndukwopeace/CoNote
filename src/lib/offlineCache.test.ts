/**
 * Tests for which cached data is kept for offline reading (FR-PWA-8).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The rule under test.
import { shouldKeepOffline } from './offlineCache'

/** A query as the rule sees it. */
function query(key: string[], status: 'success' | 'error' | 'pending' = 'success') {
  return { queryKey: key, state: { status } }
}

describe('shouldKeepOffline', () => {
  // Proves notes, published summaries, and the courses and classes that label them, are kept.
  it.each([
    ['notes', 'list'],
    ['notes', 'detail', 'n1'],
    ['courses', 'list'],
    ['classes', 'mine'],
    ['summaries', 'class', 'c1'],
    ['summaries', 'published', 'all'],
  ])('keeps %s', (...key) => {
    expect(shouldKeepOffline(query(key))).toBe(true)
  })

  // Proves anything else, and anything not loaded successfully, is not.
  it.each([
    query(['notifications', 'list']),
    query(['ai', 'conversation']),
    query(['notes', 'list'], 'error'),
    query(['notes', 'list'], 'pending'),
  ])('does not keep %j', (q) => {
    expect(shouldKeepOffline(q)).toBe(false)
  })
})
