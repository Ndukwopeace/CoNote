import { Navigate, Outlet, useLocation } from 'react-router'

import { FullPageLoader } from '@/components/common/FullPageLoader'
import { routeTo } from '@/lib/routes'

import { NotStudentNotice } from './NotStudentNotice'
import { useAuth } from './useAuth'

/**
 * Lets only signed-in students through. This is for user experience only; the database's
 * Row Level Security is the real access control (ENGINEERING_STANDARDS.md 6.4).
 */
export function RequireStudent() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') return <FullPageLoader />
  if (auth.status === 'signedOut') {
    const target = auth.exitTo ?? routeTo.login(location.pathname + location.search)
    return <Navigate to={target} replace />
  }
  if (auth.session.user.role !== 'student') return <NotStudentNotice />
  return <Outlet />
}
