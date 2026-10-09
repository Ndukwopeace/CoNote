/**
 * Tests for the teacher route table and its path builders.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { NAV_ROUTES, routeTo, TEACHER_ROUTES } from './routes'

describe('TEACHER_ROUTES', () => {
  // Proves every teacher page lives under /teacher, as the spec's route list requires.
  it('puts every page under /teacher', () => {
    for (const path of Object.values(TEACHER_ROUTES)) {
      expect(path.startsWith('/teacher/')).toBe(true)
    }
  })
})

describe('NAV_ROUTES', () => {
  // Proves the sidebar lists only pages that exist: My courses, until T2 adds the queue.
  it('lists My courses', () => {
    expect(NAV_ROUTES).toEqual([TEACHER_ROUTES.courses])
  })
})

describe('routeTo', () => {
  // Proves the sign-in path carries where to return to, encoded.
  it('builds the sign-in path with an optional return address', () => {
    expect(routeTo.login()).toBe('/teacher/login')
    expect(routeTo.login('/teacher/courses?x=1')).toBe(
      '/teacher/login?redirect=%2Fteacher%2Fcourses%3Fx%3D1',
    )
  })
})
