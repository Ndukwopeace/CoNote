import { useEffect } from 'react'
import { Navigate, Outlet, useSearchParams } from 'react-router'

import { FullPageLoader } from '@/components/common/FullPageLoader'
import { safeRedirectTarget } from '@/lib/isSafeRedirect'

import { NotStudentNotice } from './NotStudentNotice'
import { useAuth } from './useAuth'

/**
 * Wraps public pages that make no sense once signed in (landing, sign in, sign up).
 * A signed-in student goes to the page they originally asked for, if it is safe, or the
 * dashboard. Sign-in forms therefore never navigate themselves. A signed-in teacher or admin
 * sees the students-only notice (REQUIREMENTS.md section 3).
 */
export function RedirectIfSignedIn() {
  const auth = useAuth()
  const [searchParams] = useSearchParams()
  const hasPendingExit = auth.status === 'signedOut' && auth.exitTo !== null
  const { acknowledgeSignOut } = auth

  useEffect(() => {
    if (hasPendingExit) acknowledgeSignOut()
  }, [hasPendingExit, acknowledgeSignOut])

  if (auth.status === 'loading') return <FullPageLoader />
  if (auth.status === 'signedIn') {
    if (auth.session.user.role !== 'student') return <NotStudentNotice />
    const target = safeRedirectTarget(searchParams.get('redirect'), window.location.origin)
    return <Navigate to={target} replace />
  }
  return <Outlet />
}
