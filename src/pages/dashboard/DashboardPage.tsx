/**
 * The student's dashboard (placeholder until M3). Already greets the student by first name.
 */

// Temporary page body.
import { PlaceholderPage } from '@/components/common/PlaceholderPage'
// Sign-in state, for the name.
import { useAuth } from '@/features/auth/useAuth'
// "Victory Okafor" → "Victory".
import { firstName } from '@/lib/initials'

/** Dashboard, at /dashboard. */
export function DashboardPage() {
  // Current sign-in state.
  const auth = useAuth()
  // The first name when signed in (always true behind the guard), otherwise empty.
  const name = auth.status === 'signedIn' ? firstName(auth.session.user.fullName) : ''

  return (
    <PlaceholderPage
      title="Dashboard"
      milestone="M3"
      description="Your stats, upcoming classes, recent activity and a shortcut to Ask CoNote AI."
    >
      {/* Greeting, proving the session reached the page. */}
      <p className="mt-2 text-muted-foreground">Welcome, {name}.</p>
    </PlaceholderPage>
  )
}
