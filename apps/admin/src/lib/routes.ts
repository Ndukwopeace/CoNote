/**
 * The admin app's addresses (admin brief, "Admin routes"). Every page lives under /admin, so the
 * console could also share a domain with another app later without clashing.
 */

/** Fixed page addresses. */
export const ADMIN_ROUTES = {
  // Sign-in, forgot password and reset password: the only pages a signed-out visitor can open.
  login: '/admin/login',
  forgotPassword: '/admin/forgot-password',
  resetPassword: '/admin/reset-password',
  // Platform overview.
  dashboard: '/admin/dashboard',
  // Students, teachers and admins.
  users: '/admin/users',
  // Courses, teacher assignment and enrolment.
  courses: '/admin/courses',
  // Class sessions.
  classes: '/admin/classes',
  // Files and links attached to courses and classes.
  resources: '/admin/resources',
  // Monitoring of AI jobs and the summary pipeline (never approval).
  aiSummaries: '/admin/ai-summaries',
  // Measured platform activity.
  analytics: '/admin/analytics',
  // Recorded platform actions.
  auditLogs: '/admin/audit-logs',
  // Platform configuration.
  settings: '/admin/settings',
} as const

/** The sidebar's destinations, in the order the admin brief lists them. */
export const NAV_ROUTES = [
  ADMIN_ROUTES.dashboard,
  ADMIN_ROUTES.users,
  ADMIN_ROUTES.courses,
  ADMIN_ROUTES.classes,
  ADMIN_ROUTES.resources,
  ADMIN_ROUTES.aiSummaries,
  ADMIN_ROUTES.analytics,
  ADMIN_ROUTES.auditLogs,
  ADMIN_ROUTES.settings,
] as const

/**
 * Builders for addresses that contain an ID or a query.
 * SECURITY: every ID is URL-encoded, so a crafted ID can't add path segments or a query string.
 */
export const routeTo = {
  // One user's details.
  user: (userId: string) => `${ADMIN_ROUTES.users}/${encodeURIComponent(userId)}`,
  // One course's details.
  course: (courseId: string) => `${ADMIN_ROUTES.courses}/${encodeURIComponent(courseId)}`,
  // One class's details.
  class: (classId: string) => `${ADMIN_ROUTES.classes}/${encodeURIComponent(classId)}`,
  // One resource's details.
  resource: (resourceId: string) => `${ADMIN_ROUTES.resources}/${encodeURIComponent(resourceId)}`,
  // One summary's pipeline view.
  summary: (summaryId: string) => `${ADMIN_ROUTES.aiSummaries}/${encodeURIComponent(summaryId)}`,
  // Sign-in, remembering where to go afterwards (checked by isSafeRedirect before use).
  login: (redirect?: string) =>
    redirect
      ? `${ADMIN_ROUTES.login}?redirect=${encodeURIComponent(redirect)}`
      : ADMIN_ROUTES.login,
}

/**
 * `path` with `params` as its query string, for links that open a list already filtered.
 * SECURITY: URLSearchParams encodes every value, so a value can't add parameters or a fragment.
 */
export function withQuery(path: string, params: Record<string, string>): string {
  // No parameters, no question mark.
  const query = new URLSearchParams(params).toString()
  return query ? `${path}?${query}` : path
}
