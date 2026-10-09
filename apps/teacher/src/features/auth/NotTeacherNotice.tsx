/**
 * The screen for a signed-in student or admin: the portal is for teachers only.
 */

// Icon.
import { ShieldAlert } from 'lucide-react'

// Standard button.
import { Button } from '@conote/ui/button'
// Tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'

// Sign-out.
import { useAuth } from './useAuth'

/** "This portal is for teachers", with a way to sign out. */
export function NotTeacherNotice() {
  // Sign-out; the guard then shows sign-in.
  const { signOut } = useAuth()

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      {/* Tab title. */}
      <PageTitle title="Teachers only" />
      {/* Centred card. */}
      <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        {/* Decorative icon. */}
        <ShieldAlert aria-hidden="true" className="mx-auto mb-4 size-10 text-primary" />
        {/* The message, as the page's main heading. */}
        <h1 className="text-xl font-bold">This portal is for teachers</h1>
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
