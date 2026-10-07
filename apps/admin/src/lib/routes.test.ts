/**
 * Tests for the admin route table and its path builders.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { ADMIN_ROUTES, NAV_ROUTES, routeTo } from './routes'

describe('ADMIN_ROUTES', () => {
  // Proves every admin page lives under /admin, as the admin brief's route list requires.
  it('puts every page under /admin', () => {
    for (const path of Object.values(ADMIN_ROUTES)) {
      expect(path.startsWith('/admin/')).toBe(true)
    }
  })
})

describe('NAV_ROUTES', () => {
  // Proves the sidebar lists the nine sections of the admin brief, in its order.
  it('lists the nine sections in order', () => {
    expect(NAV_ROUTES).toEqual([
      ADMIN_ROUTES.dashboard,
      ADMIN_ROUTES.users,
      ADMIN_ROUTES.courses,
      ADMIN_ROUTES.classes,
      ADMIN_ROUTES.resources,
      ADMIN_ROUTES.aiSummaries,
      ADMIN_ROUTES.analytics,
      ADMIN_ROUTES.auditLogs,
      ADMIN_ROUTES.settings,
    ])
  })
})

describe('routeTo', () => {
  // Proves detail paths are built from IDs.
  it('builds detail paths', () => {
    expect(routeTo.user('u1')).toBe('/admin/users/u1')
    expect(routeTo.course('c1')).toBe('/admin/courses/c1')
    expect(routeTo.class('k1')).toBe('/admin/classes/k1')
    expect(routeTo.resource('r1')).toBe('/admin/resources/r1')
    expect(routeTo.summary('s1')).toBe('/admin/ai-summaries/s1')
  })

  // SECURITY: proves an ID can't add path segments or a query string (path injection).
  it('encodes IDs', () => {
    expect(routeTo.user('a/b?c')).toBe('/admin/users/a%2Fb%3Fc')
  })

  // Proves the sign-in path carries where to return to, encoded.
  it('builds the sign-in path with an optional return address', () => {
    expect(routeTo.login()).toBe('/admin/login')
    expect(routeTo.login('/admin/users?tab=teachers')).toBe(
      '/admin/login?redirect=%2Fadmin%2Fusers%3Ftab%3Dteachers',
    )
  })
})
