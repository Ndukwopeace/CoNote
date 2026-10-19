/**
 * Tests for building what the import function receives from a plan, the term and the chosen
 * teachers (D105).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The function under test.
import { toImportPayload } from './payload'
// The plan shape.
import type { TimetablePlan } from './types'

// A small plan: one programme, two courses.
const plan: TimetablePlan = {
  programmes: [
    { code: 'SWE-Y1', name: 'Software Engineering · Year 1', courseCodes: ['CYB 101', 'MATH 101'] },
  ],
  courses: [
    {
      code: 'CYB 101',
      title: 'Intro to Cybersecurity',
      teacherNames: ['Mr TAGWAN'],
      slots: [{ weekday: 2, start: '08:00', end: '12:00', title: 'Intro to Cybersecurity' }],
    },
    {
      code: 'MATH 101',
      title: 'Calculus I',
      teacherNames: [],
      slots: [{ weekday: 1, start: '08:00', end: '12:00', title: 'Calculus I' }],
    },
  ],
  warnings: [],
  ignored: [],
}
// A short term: two weeks.
const term = { start: '2026-10-12', end: '2026-10-18', skip: [] as string[] }

describe('toImportPayload', () => {
  // Proves the time zone, programmes and courses are carried over with the chosen teachers.
  it('carries over programmes, courses and the chosen teachers', () => {
    const payload = toImportPayload(plan, term, { 'CYB 101': 'teacher-1' }, 'Africa/Douala')

    expect(payload.timezone).toBe('Africa/Douala')
    expect(payload.programmes).toEqual([
      {
        code: 'SWE-Y1',
        name: 'Software Engineering · Year 1',
        courseCodes: ['CYB 101', 'MATH 101'],
      },
    ])
    expect(payload.courses.map((course) => [course.code, course.teacherId])).toEqual([
      ['CYB 101', 'teacher-1'],
      ['MATH 101', null],
    ])
  })

  // Proves each course's classes are the weekly slots spread over the term.
  it('spreads each course over the term', () => {
    const payload = toImportPayload(plan, term, {}, 'Africa/Douala')

    expect(payload.courses[0]?.sessions).toEqual([
      { start: '2026-10-13T08:00', end: '2026-10-13T12:00', title: 'Week 1' },
    ])
    expect(payload.courses[1]?.sessions).toEqual([
      { start: '2026-10-12T08:00', end: '2026-10-12T12:00', title: 'Week 1' },
    ])
  })

  // Proves a course the administrator gave no teacher goes with none, not undefined.
  it('sends no teacher as null', () => {
    const payload = toImportPayload(plan, term, { 'CYB 101': null }, 'Africa/Douala')

    expect(payload.courses.every((course) => course.teacherId === null)).toBe(true)
  })
})
