/**
 * The console's route table (admin brief, "Admin routes"). Every page is lazy-loaded
 * (ENGINEERING_STANDARDS.md 8). Sign-in is the only page open to signed-out visitors.
 */

// Route types and redirects.
import { Navigate, type RouteObject } from 'react-router'

// The shared guards, frame and error screen (packages/portal).
import { PortalFrame, RedirectIfSignedIn, RequireRole, RouteErrorBoundary } from '@conote/portal'

// The console's sections.
import { NAV_ITEMS } from '@/layouts/navItems'
// Route constants.
import { ADMIN_ROUTES, routeTo } from '@/lib/routes'

/** What the wrong-role screen says to a signed-in student or teacher. */
const NOT_ADMIN = {
  heading: 'This console is for administrators',
  pageTitle: 'Administrators only',
}

/** The error screen for a crashed page: it offers the dashboard as the way forward. */
const crashed = (
  <RouteErrorBoundary homePath={ADMIN_ROUTES.dashboard} homeLabel="Go to the dashboard" />
)

/** The pages inside the console frame. */
const consolePages: RouteObject[] = [
  {
    path: ADMIN_ROUTES.dashboard,
    lazy: async () => ({
      Component: (await import('@/pages/dashboard/DashboardPage')).DashboardPage,
    }),
  },
  {
    path: ADMIN_ROUTES.users,
    lazy: async () => ({ Component: (await import('@/pages/users/UsersPage')).UsersPage }),
  },
  {
    path: `${ADMIN_ROUTES.users}/:userId`,
    lazy: async () => ({
      Component: (await import('@/pages/users/UserDetailsPage')).UserDetailsPage,
    }),
  },
  {
    path: ADMIN_ROUTES.courses,
    lazy: async () => ({ Component: (await import('@/pages/courses/CoursesPage')).CoursesPage }),
  },
  {
    path: `${ADMIN_ROUTES.courses}/:courseId`,
    lazy: async () => ({
      Component: (await import('@/pages/courses/CourseDetailsPage')).CourseDetailsPage,
    }),
  },
  {
    path: ADMIN_ROUTES.classes,
    lazy: async () => ({ Component: (await import('@/pages/classes/ClassesPage')).ClassesPage }),
  },
  {
    path: `${ADMIN_ROUTES.classes}/:classId`,
    lazy: async () => ({
      Component: (await import('@/pages/classes/ClassDetailsPage')).ClassDetailsPage,
    }),
  },
  {
    path: ADMIN_ROUTES.resources,
    lazy: async () => ({
      Component: (await import('@/pages/resources/ResourcesPage')).ResourcesPage,
    }),
  },
  {
    path: `${ADMIN_ROUTES.resources}/:resourceId`,
    lazy: async () => ({
      Component: (await import('@/pages/resources/ResourceDetailsPage')).ResourceDetailsPage,
    }),
  },
  {
    path: ADMIN_ROUTES.aiSummaries,
    lazy: async () => ({
      Component: (await import('@/pages/ai-summaries/AiSummariesPage')).AiSummariesPage,
    }),
  },
  {
    path: `${ADMIN_ROUTES.aiSummaries}/:summaryId`,
    lazy: async () => ({
      Component: (await import('@/pages/ai-summaries/SummaryPipelinePage')).SummaryPipelinePage,
    }),
  },
  {
    path: ADMIN_ROUTES.analytics,
    lazy: async () => ({
      Component: (await import('@/pages/analytics/AnalyticsPage')).AnalyticsPage,
    }),
  },
  {
    path: ADMIN_ROUTES.auditLogs,
    lazy: async () => ({
      Component: (await import('@/pages/audit-logs/AuditLogsPage')).AuditLogsPage,
    }),
  },
  {
    path: ADMIN_ROUTES.settings,
    lazy: async () => ({
      Component: (await import('@/pages/settings/SettingsPage')).SettingsPage,
    }),
  },
  // Any other /admin address: not-found, inside the frame so the navigation stays.
  {
    path: '/admin/*',
    lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
  },
]

/** The whole table. */
export const routes: RouteObject[] = [
  // The bare addresses lead to the dashboard (the guard sends signed-out visitors to sign-in).
  { path: '/', element: <Navigate to={ADMIN_ROUTES.dashboard} replace /> },
  { path: '/admin', element: <Navigate to={ADMIN_ROUTES.dashboard} replace /> },
  // Sign-in and password recovery, for signed-out visitors only.
  {
    element: (
      <RedirectIfSignedIn allowedRole="admin" notice={NOT_ADMIN} home={ADMIN_ROUTES.dashboard} />
    ),
    errorElement: crashed,
    children: [
      {
        path: ADMIN_ROUTES.login,
        lazy: async () => ({ Component: (await import('@/pages/auth/LoginPage')).LoginPage }),
      },
      {
        path: ADMIN_ROUTES.forgotPassword,
        lazy: async () => ({
          Component: (await import('@/pages/auth/ForgotPasswordPage')).ForgotPasswordPage,
        }),
      },
      {
        path: ADMIN_ROUTES.resetPassword,
        lazy: async () => ({
          Component: (await import('@/pages/auth/ResetPasswordPage')).ResetPasswordPage,
        }),
      },
    ],
  },
  // The console, for admins only.
  {
    element: <RequireRole allowedRole="admin" notice={NOT_ADMIN} loginTo={routeTo.login} />,
    children: [
      {
        element: (
          <PortalFrame
            name="Admin"
            homePath={ADMIN_ROUTES.dashboard}
            items={NAV_ITEMS}
            settingsPath={ADMIN_ROUTES.settings}
          />
        ),
        // A crashed page shows the error screen inside the frame.
        children: [{ errorElement: crashed, children: consolePages }],
      },
    ],
  },
  // Any address outside /admin: not-found on its own.
  {
    path: '*',
    lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
  },
]
