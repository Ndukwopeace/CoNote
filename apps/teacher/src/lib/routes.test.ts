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
  // Proves the sidebar lists My courses and the review queue, in that order.
  it('lists My courses, then the review queue', () => {
    expect(NAV_ROUTES).toEqual([TEACHER_ROUTES.courses, TEACHER_ROUTES.reviews])
  })
})

describe('routeTo', () => {
  // Proves detail paths are built from IDs.
  it('builds course and review paths', () => {
    expect(routeTo.course('mth-202')).toBe('/teacher/courses/mth-202')
    expect(routeTo.review('s1')).toBe('/teacher/reviews/s1')
  })

  // SECURITY: proves an ID can't add path segments or a query string (path injection).
  it('encodes IDs', () => {
    expect(routeTo.course('a/b?c')).toBe('/teacher/courses/a%2Fb%3Fc')
    expect(routeTo.review('../x')).toBe('/teacher/reviews/..%2Fx')
  })

  // Proves the sign-in path carries where to return to, encoded.
  it('builds the sign-in path with an optional return address', () => {
    expect(routeTo.login()).toBe('/teacher/login')
    expect(routeTo.login('/teacher/courses?x=1')).toBe(
      '/teacher/login?redirect=%2Fteacher%2Fcourses%3Fx%3D1',
    )
  })
})
