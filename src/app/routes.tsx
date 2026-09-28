import { Navigate, type RouteObject } from 'react-router'

import { FullPageLoader } from '@/components/common/FullPageLoader'
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary'
import { RedirectIfSignedIn } from '@/features/auth/RedirectIfSignedIn'
import { RequireStudent } from '@/features/auth/RequireStudent'
import { AuthLayout } from '@/layouts/AuthLayout'
import { PortalLayout } from '@/layouts/PortalLayout'
import { PublicLayout } from '@/layouts/PublicLayout'
import { routeTo } from '@/lib/routes'

/** Portal pages. Each is lazy-loaded (ENGINEERING_STANDARDS.md 8) and has its own error boundary. */
const portalRoutes: RouteObject[] = [
  {
    path: 'dashboard',
    lazy: async () => ({
      Component: (await import('@/pages/dashboard/DashboardPage')).DashboardPage,
    }),
  },
  {
    path: 'classes',
    lazy: async () => ({ Component: (await import('@/pages/classes/ClassesPage')).ClassesPage }),
  },
  {
    path: 'courses',
    lazy: async () => ({ Component: (await import('@/pages/courses/CoursesPage')).CoursesPage }),
  },
  {
    path: 'courses/:courseId',
    lazy: async () => ({
      Component: (await import('@/pages/courses/CourseDetailsPage')).CourseDetailsPage,
    }),
  },
  {
    path: 'courses/:courseId/classes/:classId',
    lazy: async () => ({ Component: (await import('@/pages/courses/ClassPage')).ClassPage }),
  },
  {
    path: 'courses/:courseId/classes/:classId/summary',
    lazy: async () => ({ Component: (await import('@/pages/courses/SummaryPage')).SummaryPage }),
  },
  {
    path: 'notes',
    lazy: async () => ({ Component: (await import('@/pages/notes/NotesPage')).NotesPage }),
  },
  {
    path: 'notes/new',
    lazy: async () => ({ Component: (await import('@/pages/notes/NewNotePage')).NewNotePage }),
  },
  {
    path: 'notes/:noteId',
    lazy: async () => ({ Component: (await import('@/pages/notes/NotePage')).NotePage }),
  },
  {
    path: 'notes/:noteId/edit',
    lazy: async () => ({ Component: (await import('@/pages/notes/EditNotePage')).EditNotePage }),
  },
  {
    path: 'ask-ai',
    lazy: async () => ({ Component: (await import('@/pages/ask-ai/AskAiPage')).AskAiPage }),
  },
  {
    path: 'notifications',
    lazy: async () => ({
      Component: (await import('@/pages/notifications/NotificationsPage')).NotificationsPage,
    }),
  },
  {
    path: 'settings/:tab?',
    lazy: async () => ({ Component: (await import('@/pages/settings/SettingsPage')).SettingsPage }),
  },
  { path: 'profile', element: <Navigate to={routeTo.settings('profile')} replace /> },
].map((route) => ({ ...route, errorElement: <RouteErrorBoundary /> }))

/** The full route table (REQUIREMENTS.md section 7). Shared by the app and the tests. */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <FullPageLoader />,
    children: [
      {
        element: <RedirectIfSignedIn />,
        children: [
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
      {
        element: <RequireStudent />,
        children: [{ element: <PortalLayout />, children: portalRoutes }],
      },
      {
        path: '*',
        lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
      },
    ],
  },
]
