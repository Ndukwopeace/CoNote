/**
 * The teacher app's addresses (teacher REQUIREMENTS section 3). Every page lives under /teacher,
 * so the portal could also share a domain with another app later without clashing. T2 adds the
 * course, review queue and review pages.
 */

/** Fixed page addresses. */
export const TEACHER_ROUTES = {
  // Sign-in, forgot password and reset password: the only pages a signed-out visitor can open.
  login: '/teacher/login',
  forgotPassword: '/teacher/forgot-password',
  resetPassword: '/teacher/reset-password',
  // The teacher's courses: where signing in lands.
  courses: '/teacher/courses',
} as const

/** The sidebar's destinations, in order. */
export const NAV_ROUTES = [TEACHER_ROUTES.courses] as const

/**
 * Builders for addresses that contain a query.
 * SECURITY: every value is URL-encoded, so a crafted value can't add path segments or parameters.
 */
export const routeTo = {
  // Sign-in, remembering where to go afterwards (checked by isSafeRedirect before use).
  login: (redirect?: string) =>
    redirect
      ? `${TEACHER_ROUTES.login}?redirect=${encodeURIComponent(redirect)}`
      : TEACHER_ROUTES.login,
}
