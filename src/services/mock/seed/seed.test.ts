/**
 * Tests for the demo data (REQUIREMENTS.md section 13). The seed is built relative to "now", so
 * these rules hold whenever the demo is opened.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The class status rule, to check live/upcoming/completed.
import { getClassStatus } from '@/lib/classes'

// The builder under test.
import { createSeed, PRESET_TAGS } from './index'

// A few different "nows", including late evening and just after midnight.
const nows = [
  new Date(2026, 8, 28, 10, 7),
  new Date(2026, 8, 28, 23, 50),
  new Date(2026, 8, 29, 0, 5),
]

describe('createSeed', () => {
  // Proves the four courses from the wireframes, with SWE 311's four named classes.
  it('has the four courses and SWE 311 classes from section 13', () => {
    // Act.
    const seed = createSeed(nows[0] ?? new Date())

    // Assert: course codes.
    expect(seed.courses.map((course) => course.code)).toEqual([
      'SWE 311',
      'ENG 201',
      'CSE 205',
      'BUS 207',
    ])
    // Assert: SWE 311's classes, in order.
    const swe = seed.classes
      .filter((c) => c.courseId === 'swe-311')
      .sort((a, b) => a.number - b.number)
    expect(swe.map((c) => c.title)).toEqual([
      'Introduction to Software Engineering',
      'Software Requirements',
      'Requirement Validation',
      'SDLC Models',
    ])
  })

  // Proves the demo always has a live, an upcoming and a completed class, whatever the time.
  it.each(nows)('has live, upcoming and completed classes at %s', (now) => {
    // Act.
    const statuses = new Set(createSeed(now).classes.map((c) => getClassStatus(c, now)))

    // Assert.
    expect(statuses).toEqual(new Set(['live', 'upcoming', 'completed']))
  })

  // Proves the summary stages required by section 13.
  it('has at least two published summaries, one in review and one processing', () => {
    // Act.
    const seed = createSeed(nows[0] ?? new Date())
    const count = (status: string) => seed.classes.filter((c) => c.summaryStatus === status).length

    // Assert.
    expect(count('published')).toBeGreaterThanOrEqual(2)
    expect(count('in_review')).toBeGreaterThanOrEqual(1)
    expect(count('processing')).toBeGreaterThanOrEqual(1)
  })

  // SECURITY: proves summary content exists only for published classes, so draft text can't
  // reach a student even by mistake (section 4, RLS rule in 12.2).
  it('stores summary content only for published classes', () => {
    // Act.
    const seed = createSeed(nows[0] ?? new Date())
    const published = new Set(
      seed.classes.filter((c) => c.summaryStatus === 'published').map((c) => c.id),
    )

    // Assert: one summary per published class, and none for any other.
    expect(new Set(seed.summaries.map((s) => s.classId))).toEqual(published)
  })

  // Proves the note rules: 10–12 notes, every preset tag used, each attached to a real class.
  it('has 10–12 notes using every preset tag, each on a real class of its course', () => {
    // Act.
    const seed = createSeed(nows[0] ?? new Date())

    // Assert: count.
    expect(seed.notes.length).toBeGreaterThanOrEqual(10)
    expect(seed.notes.length).toBeLessThanOrEqual(12)
    // Assert: every preset tag appears somewhere.
    const used = new Set(seed.notes.flatMap((note) => note.tags))
    for (const tag of PRESET_TAGS) expect(used).toContain(tag)
    // Assert: each note's class exists and belongs to the note's course.
    for (const note of seed.notes) {
      const session = seed.classes.find((c) => c.id === note.classId)
      expect(session?.courseId).toBe(note.courseId)
    }
  })

  // Proves the notification rules: 8, all four types, some unread.
  it('has 8 notifications across all four types, some unread', () => {
    // Act.
    const { notifications } = createSeed(nows[0] ?? new Date())

    // Assert.
    expect(notifications).toHaveLength(8)
    expect(new Set(notifications.map((n) => n.type))).toEqual(
      new Set(['summary', 'system', 'message', 'note']),
    )
    expect(notifications.some((n) => !n.read)).toBe(true)
    expect(notifications.some((n) => n.read)).toBe(true)
  })

  // Proves each course's class count matches its classes, so cards and pages agree.
  it('keeps each course class count in step with its classes', () => {
    // Act.
    const seed = createSeed(nows[0] ?? new Date())

    // Assert.
    for (const course of seed.courses) {
      expect(seed.classes.filter((c) => c.courseId === course.id)).toHaveLength(course.classCount)
    }
  })
})
