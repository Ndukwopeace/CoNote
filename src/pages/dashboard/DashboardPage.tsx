import { PlaceholderPage } from '@/components/common/PlaceholderPage'
import { useAuth } from '@/features/auth/useAuth'
import { firstName } from '@/lib/initials'

export function DashboardPage() {
  const auth = useAuth()
  const name = auth.status === 'signedIn' ? firstName(auth.session.user.fullName) : ''

  return (
    <PlaceholderPage
      title="Dashboard"
      milestone="M3"
      description="Your stats, upcoming classes, recent activity and a shortcut to Ask CoNote AI."
    >
      <p className="mt-2 text-muted-foreground">Welcome, {name}.</p>
    </PlaceholderPage>
  )
}
