/**
 * The screen teachers and admins see if they sign in to the student portal.
 */

// Shield icon for the notice.
import { ShieldAlert } from 'lucide-react'

// Standard button.
import { Button } from '@conote/ui/button'

// Sign-out comes from the auth context.
import { useAuth } from './useAuth'

/** Shown to teachers and admins who sign in here (REQUIREMENTS.md section 3). */
export function NotStudentNotice() {
  // Only the sign-out action is needed.
  const { signOut } = useAuth()

  return (
    // SECURITY: this replaces the whole page, so no student content, navigation or teacher
    // links are rendered for a non-student account.
    <main className="grid min-h-dvh place-items-center px-4">
      {/* Centred card. */}
      <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        {/* Decorative icon, hidden from screen readers. */}
        <ShieldAlert aria-hidden="true" className="mx-auto mb-4 size-10 text-primary" />
        {/* The message, as the page's main heading. */}
        <h1 className="text-xl font-bold">This portal is for students</h1>
        {/* Where to go instead. */}
        <p className="mt-2 text-muted-foreground">Please use the teacher or admin portal.</p>
        {/* Sign out; signOut never rejects, and the guard handles where to go next. */}
        <Button className="mt-6" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </main>
  )
}
