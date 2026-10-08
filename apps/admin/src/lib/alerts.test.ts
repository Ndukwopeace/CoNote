/**
 * Tests for how each alert reads and where it leads (admin REQUIREMENTS section 10).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Every alert kind.
import { ALERT_KINDS } from '@/types/dashboard'

// The unit under test.
import { alertContent } from './alerts'

describe('alertContent', () => {
  // Proves every kind has wording and a link into the console.
  it.each(ALERT_KINDS)('describes %s with a link into the console', (kind) => {
    // Act.
    const content = alertContent({ kind, count: 2, days: 3 })

    // Assert.
    expect(content.message).not.toBe('')
    expect(content.to.startsWith('/admin/')).toBe(true)
  })

  // Proves counts read naturally in the singular and the plural.
  it('uses the singular for one and the plural for more', () => {
    expect(alertContent({ kind: 'courses_without_teacher', count: 1 }).message).toBe(
      '1 course has no teacher',
    )
    expect(alertContent({ kind: 'courses_without_teacher', count: 4 }).message).toBe(
      '4 courses have no teacher',
    )
  })

  // Proves the review alert names the day limit from Settings.
  it('names the review limit', () => {
    expect(alertContent({ kind: 'summaries_waiting_review', count: 2, days: 5 }).message).toBe(
      '2 summaries have waited in review for more than 5 days',
    )
  })

  // Proves security and failure alerts are marked critical, and the rest warnings.
  it('marks security and failures as critical', () => {
    expect(alertContent({ kind: 'security_events', count: 1 }).severity).toBe('critical')
    expect(alertContent({ kind: 'ai_jobs_failed', count: 1 }).severity).toBe('critical')
    expect(alertContent({ kind: 'courses_without_teacher', count: 1 }).severity).toBe('warning')
  })

  // Proves the links open the screen filtered to the problem.
  it('links to the filtered screen', () => {
    expect(alertContent({ kind: 'ai_jobs_failed', count: 1 }).to).toBe(
      '/admin/ai-summaries?job=failed',
    )
    expect(alertContent({ kind: 'security_events', count: 1 }).to).toBe(
      '/admin/audit-logs?category=security',
    )
  })
})
