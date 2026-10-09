/**
 * The portal's route table (teacher REQUIREMENTS section 3). Every page is lazy-loaded
 * (ENGINEERING_STANDARDS.md 8). Sign-in and password recovery are the only pages open to
 * signed-out visitors.
 */

// Route types and redirects.
import { Navigate, type RouteObject } from 'react-router'

// Error screen for crashed pages.
import { RouteErrorBoundary } from '@/components/common/RouteErrorBoundary'
// Guards.
import { RedirectIfSignedIn } from '@/features/auth/RedirectIfSignedIn'
import { RequireTeacher } from '@/features/auth/RequireTeacher'
// The portal frame.
import { TeacherLayout } from '@/layouts/TeacherLayout'
// Route constants.
import { TEACHER_ROUTES } from '@/lib/routes'

/** The pages inside the portal frame. */
const portalPages: RouteObject[] = [
  {
    path: TEACHER_ROUTES.courses,
    lazy: async () => ({ Component: (await import('@/pages/courses/CoursesPage')).CoursesPage }),
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
    element: <RedirectIfSignedIn />,
    errorElement: <RouteErrorBoundary />,
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
    element: <RequireTeacher />,
    children: [
      {
        element: <TeacherLayout />,
        // A crashed page shows the error screen inside the frame.
        children: [{ errorElement: <RouteErrorBoundary />, children: portalPages }],
      },
    ],
  },
  // Any address outside /teacher: not-found on its own.
  {
    path: '*',
    lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }),
  },
]
