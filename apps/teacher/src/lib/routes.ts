/**
 * The teacher app's addresses (teacher REQUIREMENTS section 3). Every page lives under /teacher,
 * so the portal could also share a domain with another app later without clashing.
 */

/** Fixed page addresses. */
export const TEACHER_ROUTES = {
  // Sign-in, forgot password and reset password: the only pages a signed-out visitor can open.
  login: '/teacher/login',
  forgotPassword: '/teacher/forgot-password',
  resetPassword: '/teacher/reset-password',
  // The teacher's courses: where signing in lands.
  courses: '/teacher/courses',
  // The summaries waiting for the teacher, longest wait first.
  reviews: '/teacher/reviews',
} as const

/** The sidebar's destinations, in order. */
export const NAV_ROUTES = [TEACHER_ROUTES.courses, TEACHER_ROUTES.reviews] as const

/**
 * Builders for addresses that contain a query.
 * SECURITY: every value is URL-encoded, so a crafted value can't add path segments or parameters.
 */
export const routeTo = {
  // One course, with its classes.
  course: (courseId: string) => `${TEACHER_ROUTES.courses}/${encodeURIComponent(courseId)}`,
  // One summary, opened for review.
  review: (summaryId: string) => `${TEACHER_ROUTES.reviews}/${encodeURIComponent(summaryId)}`,
  // Sign-in, remembering where to go afterwards (checked by isSafeRedirect before use).
  login: (redirect?: string) =>
    redirect
      ? `${TEACHER_ROUTES.login}?redirect=${encodeURIComponent(redirect)}`
      : TEACHER_ROUTES.login,
}
