/**
 * The route guards of a staff portal (admin brief "Admin authentication", teacher REQUIREMENTS
 * section 3). Signed-out visitors go to sign-in; a signed-in user of another role sees a notice;
 * the portal's own role gets in.
 * SECURITY: these guards are for the user experience only. Real enforcement is the backend's Row
 * Level Security and the role checks in its server functions (ENGINEERING_STANDARDS.md 6.4).
 */

// Routing.
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
// Icon.
import { ShieldAlert } from 'lucide-react'
// Children type.
import type { ReactNode } from 'react'

// Picks a safe destination from ?redirect=.
import { safeRedirectTarget } from '@conote/core/isSafeRedirect'
// The shared vocabulary.
import type { Role } from '@conote/domain'
// Standard button, spinner and tab title.
import { Button } from '@conote/ui/button'
import { FullPageLoader } from '@conote/ui/common/FullPageLoader'
import { PageTitle } from '@conote/ui/common/PageTitle'

// Sign-in state.
import { useAuth } from './useAuth'

/** What a portal gives its guards. */
interface GuardOptions {
  // The one role this portal admits.
  allowedRole: Role
  // What the wrong-role screen says: its heading, and the tab title.
  notice: { heading: string; pageTitle: string }
}

/** The screen for a signed-in user of another role, with a way to sign out. */
export function WrongRoleNotice({ heading, pageTitle }: Readonly<GuardOptions['notice']>) {
  // Sign-out; the guard then shows sign-in.
  const { signOut } = useAuth()

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      {/* Tab title. */}
      <PageTitle title={pageTitle} />
      {/* Centred card. */}
      <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        {/* Decorative icon. */}
        <ShieldAlert aria-hidden="true" className="mx-auto mb-4 size-10 text-primary" />
        {/* The message, as the page's main heading. */}
        <h1 className="text-xl font-bold">{heading}</h1>
        {/* Where to go instead, without linking to other portals. */}
        <p className="mt-2 text-muted-foreground">
          Your account doesn&apos;t have access. Please use the CoNote portal for your role.
        </p>
        {/* Sign out; never rejects, and the guard handles where to go next. */}
        <Button className="mt-6" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </main>
  )
}

/** Shows the portal only to signed-in users of its role. */
export function RequireRole({
  allowedRole,
  notice,
  loginTo,
}: Readonly<GuardOptions & { loginTo: (redirect: string) => string }>): ReactNode {
  // Sign-in state.
  const auth = useAuth()
  // The address asked for, to come back to after sign-in.
  const location = useLocation()

  // Still checking the stored session.
  if (auth.status === 'loading') return <FullPageLoader />
  // Signed out: sign in first, then return here.
  if (auth.status === 'signedOut') {
    return <Navigate to={loginTo(location.pathname + location.search)} replace />
  }
  // SECURITY: any other role stops here (privilege escalation through the UI).
  if (auth.session.user.role !== allowedRole) return <WrongRoleNotice {...notice} />
  // The right role: show the page.
  return <Outlet />
}

/** Shows sign-in only to signed-out visitors; a signed-in user of the role is sent on. */
export function RedirectIfSignedIn({
  allowedRole,
  notice,
  home,
}: Readonly<GuardOptions & { home: string }>): ReactNode {
  // Sign-in state.
  const auth = useAuth()
  // The ?redirect= value.
  const [searchParams] = useSearchParams()

  // Still checking the stored session.
  if (auth.status === 'loading') return <FullPageLoader />
  // Signed out: show the sign-in page.
  if (auth.status === 'signedOut') return <Outlet />
  // A user of another role who is signed in can't use the portal.
  if (auth.session.user.role !== allowedRole) return <WrongRoleNotice {...notice} />
  // SECURITY: the destination comes from the address bar, so it is checked (open redirect).
  const target = safeRedirectTarget(searchParams.get('redirect'), window.location.origin, home)
  return <Navigate to={target} replace />
}
