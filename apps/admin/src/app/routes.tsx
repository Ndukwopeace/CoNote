/**
 * The console's route table (admin brief, "Admin routes"). Every page is lazy-loaded
 * (ENGINEERING_STANDARDS.md 8). Sign-in is the only page open to signed-out visitors.
 */

// Route types and redirects.
import { Navigate, type RouteObject } from 'react-router'

// Error screen for crashed pages.
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary'
// Guards.
import { RedirectIfSignedIn } from '@/features/auth/RedirectIfSignedIn'
import { RequireAdmin } from '@/features/auth/RequireAdmin'
// The console frame.
import { AdminLayout } from '@/layouts/AdminLayout'
// Route constants.
import { ADMIN_ROUTES } from '@/lib/routes'

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
  // Sign-in, for signed-out visitors only.
  {
    element: <RedirectIfSignedIn />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: ADMIN_ROUTES.login,
        lazy: async () => ({ Component: (await import('@/pages/auth/LoginPage')).LoginPage }),
      },
    ],
  },
  // The console, for admins only.
  {
    element: <RequireAdmin />,
    children: [
      {
        element: <AdminLayout />,
        // A crashed page shows the error screen inside the frame.
        children: [{ errorElement: <RouteErrorBoundary />, children: consolePages }],
      },
    ],
  },
  // Any address outside /admin: not-found on its own.
  {
    path: '*',
    lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
  },
]
