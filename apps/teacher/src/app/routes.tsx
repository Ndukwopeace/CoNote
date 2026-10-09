/**
 * The portal's route table (teacher REQUIREMENTS section 3). Every page is lazy-loaded
 * (ENGINEERING_STANDARDS.md 8). Sign-in and password recovery are the only pages open to
 * signed-out visitors.
 */

// Route types and redirects.
import { Navigate, type RouteObject } from 'react-router'

// The shared guards, frame and error screen (packages/portal).
import { PortalFrame, RedirectIfSignedIn, RequireRole, RouteErrorBoundary } from '@conote/portal'

// The portal's sections.
import { NAV_ITEMS } from '@/layouts/navItems'
// Route constants.
import { TEACHER_ROUTES, routeTo } from '@/lib/routes'

/** What the wrong-role screen says to a signed-in student or admin. */
const NOT_TEACHER = { heading: 'This portal is for teachers', pageTitle: 'Teachers only' }

/** The error screen for a crashed page: it offers My courses as the way forward. */
const crashed = (
  <RouteErrorBoundary homePath={TEACHER_ROUTES.courses} homeLabel="Go to My courses" />
)

/** The pages inside the portal frame. */
const portalPages: RouteObject[] = [
  {
    path: TEACHER_ROUTES.courses,
    lazy: async () => ({ Component: (await import('@/pages/courses/CoursesPage')).CoursesPage }),
  },
  {
    path: `${TEACHER_ROUTES.courses}/:courseId`,
    lazy: async () => ({
      Component: (await import('@/pages/courses/CourseDetailsPage')).CourseDetailsPage,
    }),
  },
  {
    path: TEACHER_ROUTES.reviews,
    lazy: async () => ({
      Component: (await import('@/pages/reviews/ReviewQueuePage')).ReviewQueuePage,
    }),
  },
  {
    path: `${TEACHER_ROUTES.reviews}/:summaryId`,
    lazy: async () => ({
      Component: (await import('@/pages/reviews/ReviewPage')).ReviewPage,
    }),
  },
  // Any other /teacher address: not-found, inside the frame so the navigation stays.
  {
    path: '/teacher/*',
    lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
  },
]

/** The whole table. */
export const routes: RouteObject[] = [
  // The bare addresses lead to My courses (the guard sends signed-out visitors to sign-in).
  { path: '/', element: <Navigate to={TEACHER_ROUTES.courses} replace /> },
  { path: '/teacher', element: <Navigate to={TEACHER_ROUTES.courses} replace /> },
  // Sign-in and password recovery, for signed-out visitors only.
  {
    element: (
      <RedirectIfSignedIn
        allowedRole="teacher"
        notice={NOT_TEACHER}
        home={TEACHER_ROUTES.courses}
      />
    ),
    errorElement: crashed,
    children: [
      {
        path: TEACHER_ROUTES.login,
        lazy: async () => ({ Component: (await import('@/pages/auth/LoginPage')).LoginPage }),
      },
      {
        path: TEACHER_ROUTES.forgotPassword,
        lazy: async () => ({
          Component: (await import('@/pages/auth/ForgotPasswordPage')).ForgotPasswordPage,
        }),
      },
      {
        path: TEACHER_ROUTES.resetPassword,
        lazy: async () => ({
          Component: (await import('@/pages/auth/ResetPasswordPage')).ResetPasswordPage,
        }),
      },
    ],
  },
  // The portal, for teachers only.
  {
    element: <RequireRole allowedRole="teacher" notice={NOT_TEACHER} loginTo={routeTo.login} />,
    children: [
      {
        element: <PortalFrame name="Teacher" homePath={TEACHER_ROUTES.courses} items={NAV_ITEMS} />,
        // A crashed page shows the error screen inside the frame.
        children: [{ errorElement: crashed, children: portalPages }],
      },
    ],
  },
  // Any address outside /teacher: not-found on its own.
  {
    path: '*',
    lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
  },
]
