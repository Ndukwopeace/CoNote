/**
 * The full route table (REQUIREMENTS.md section 7): which page appears at which address, which
 * layout wraps it, and which guard protects it. The app and the tests share this table.
 */

// Navigate redirects; RouteObject is the type of one route entry.
import { Navigate, type RouteObject } from 'react-router'

// Spinner shown while the first page's code downloads.
import { FullPageLoader } from '@/components/common/FullPageLoader'
// The screen shown when a page crashes.
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary'
// Guard for public pages (sends signed-in students on).
import { RedirectIfSignedIn } from '@/features/auth/RedirectIfSignedIn'
// Guard for portal pages (students only).
import { RequireStudent } from '@/features/auth/RequireStudent'
// Centred card for sign in and password pages.
import { AuthLayout } from '@/layouts/AuthLayout'
// Signed-in shell with navigation.
import { PortalLayout } from '@/layouts/PortalLayout'
// Header and footer for public pages.
import { PublicLayout } from '@/layouts/PublicLayout'
// Route builders.
import { routeTo } from '@/lib/routes'

/**
 * Portal pages. Each is lazy-loaded (ENGINEERING_STANDARDS.md 8) and has its own error boundary.
 * "Lazy" means a page's code downloads only when first visited, keeping the first load small.
 */
const portalRoutes: RouteObject[] = [
  // Home after sign-in.
  {
    path: 'dashboard',
    lazy: async () => ({
      Component: (await import('@/pages/dashboard/DashboardPage')).DashboardPage,
    }),
  },
  // Every class across courses.
  {
    path: 'classes',
    lazy: async () => ({ Component: (await import('@/pages/classes/ClassesPage')).ClassesPage }),
  },
  // Enrolled courses.
  {
    path: 'courses',
    lazy: async () => ({ Component: (await import('@/pages/courses/CoursesPage')).CoursesPage }),
  },
  // One course.
  {
    path: 'courses/:courseId',
    lazy: async () => ({
      Component: (await import('@/pages/courses/CourseDetailsPage')).CourseDetailsPage,
    }),
  },
  // One class in a course.
  {
    path: 'courses/:courseId/classes/:classId',
    lazy: async () => ({ Component: (await import('@/pages/courses/ClassPage')).ClassPage }),
  },
  // A class's published summary.
  {
    path: 'courses/:courseId/classes/:classId/summary',
    lazy: async () => ({ Component: (await import('@/pages/courses/SummaryPage')).SummaryPage }),
  },
  // All notes.
  {
    path: 'notes',
    lazy: async () => ({ Component: (await import('@/pages/notes/NotesPage')).NotesPage }),
  },
  // New note. Listed before "notes/:noteId"; React Router also ranks exact paths first.
  {
    path: 'notes/new',
    lazy: async () => ({ Component: (await import('@/pages/notes/NewNotePage')).NewNotePage }),
  },
  // Read one note.
  {
    path: 'notes/:noteId',
    lazy: async () => ({ Component: (await import('@/pages/notes/NotePage')).NotePage }),
  },
  // Edit one note.
  {
    path: 'notes/:noteId/edit',
    lazy: async () => ({ Component: (await import('@/pages/notes/EditNotePage')).EditNotePage }),
  },
  // Ask CoNote AI.
  {
    path: 'ask-ai',
    lazy: async () => ({ Component: (await import('@/pages/ask-ai/AskAiPage')).AskAiPage }),
  },
  // Notifications.
  {
    path: 'notifications',
    lazy: async () => ({
      Component: (await import('@/pages/notifications/NotificationsPage')).NotificationsPage,
    }),
  },
  // Settings; the tab is optional and checked by the page itself.
  {
    path: 'settings/:tab?',
    lazy: async () => ({ Component: (await import('@/pages/settings/SettingsPage')).SettingsPage }),
  },
  // The old profile address sends students to the profile tab (decision D7).
  { path: 'profile', element: <Navigate to={routeTo.settings('profile')} replace /> },
  // Give every portal page its own error screen, so a crash leaves the navigation working.
].map((route) => ({ ...route, errorElement: <RouteErrorBoundary /> }))

/** The full route table (REQUIREMENTS.md section 7). Shared by the app and the tests. */
export const routes: RouteObject[] = [
  {
    // Last-resort error screen for anything the inner boundaries miss.
    errorElement: <RouteErrorBoundary />,
    // Shown while the first page's code is loading.
    hydrateFallbackElement: <FullPageLoader />,
    children: [
      // Public pages that signed-in students should skip.
      {
        element: <RedirectIfSignedIn />,
        children: [
          // Landing page, inside the public header and footer.
          {
            element: <PublicLayout />,
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('@/pages/landing/LandingPage')).LandingPage,
                }),
              },
            ],
          },
          // Sign in and sign up, inside the centred card.
          {
            element: <AuthLayout />,
            children: [
              {
                path: 'login',
                lazy: async () => ({
                  Component: (await import('@/pages/auth/LoginPage')).LoginPage,
                }),
              },
              {
                path: 'signup',
                lazy: async () => ({
                  Component: (await import('@/pages/auth/SignUpPage')).SignUpPage,
                }),
              },
            ],
          },
        ],
      },
      // Password pages. Not behind RedirectIfSignedIn: a reset link must work even if a
      // session exists on this device.
      {
        element: <AuthLayout />,
        children: [
          {
            path: 'forgot-password',
            lazy: async () => ({
              Component: (await import('@/pages/auth/ForgotPasswordPage')).ForgotPasswordPage,
            }),
          },
          {
            path: 'reset-password',
            lazy: async () => ({
              Component: (await import('@/pages/auth/ResetPasswordPage')).ResetPasswordPage,
            }),
          },
        ],
      },
      // Legal pages, open to everyone.
      {
        element: <PublicLayout />,
        children: [
          {
            path: 'terms',
            lazy: async () => ({ Component: (await import('@/pages/legal/TermsPage')).TermsPage }),
          },
          {
            path: 'privacy',
            lazy: async () => ({
              Component: (await import('@/pages/legal/PrivacyPage')).PrivacyPage,
            }),
          },
        ],
      },
      // SECURITY: every portal page sits behind RequireStudent, so none renders for a
      // signed-out visitor or a non-student.
      {
        element: <RequireStudent />,
        children: [{ element: <PortalLayout />, children: portalRoutes }],
      },
      // Any other address: the not-found page.
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
]
