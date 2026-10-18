/**
 * Home, at /dashboard (D101, D102, D103): loads what Home needs, then shows the Home screen. The
 * frame (dark theme, no sidebar or bottom bar) is HomeLayout's.
 */

// Tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// Sign-in state, for the name.
import { useAuth } from '@/features/auth/useAuth'
// The screen.
import { HomeScreen } from '@/features/home/HomeScreen'
// Data hooks.
import { useMyClasses } from '@/hooks/useClasses'
import { useMyCourses } from '@/hooks/useCourses'
import { useUnreadCount } from '@/hooks/useNotifications'
import { useNow } from '@/hooks/useNow'
import { usePublishedSummaries } from '@/hooks/useSummaries'
// Greeting.
import { greetingFor } from '@/lib/dates'
// "Victory Okafor" → "Victory".
import { firstName } from '@conote/core/initials'

/** Home. */
export function DashboardPage() {
  // Current sign-in state.
  const auth = useAuth()
  // The current time, refreshed each minute so the greeting keeps up.
  const now = useNow()
  // The first name when signed in (always true behind the guard), otherwise empty.
  const name = auth.status === 'signedIn' ? firstName(auth.session.user.fullName) : ''
  // What the screen and its navigation need. The summaries and the unread count only decorate the
  // navigation, so a failure there never blocks Home.
  const courses = useMyCourses()
  const classes = useMyClasses()
  const summaries = usePublishedSummaries()
  const unread = useUnreadCount()

  // Where the data stands: the screen shows its frame in every state.
  const failed = courses.error ?? classes.error
  let status: 'loading' | 'error' | 'ready' = 'loading'
  if (failed) status = 'error'
  else if (courses.data && classes.data) status = 'ready'

  return (
    <>
      {/* Tab title "Home", matching the tab bar (D35). */}
      <PageTitle title="Home" />
      <HomeScreen
        status={status}
        error={failed}
        onRetry={() => {
          void courses.refetch()
          void classes.refetch()
        }}
        courses={courses.data ?? []}
        classes={classes.data ?? []}
        newSummaries={summaries.data?.filter((s) => !s.viewedByMe).length ?? 0}
        unread={unread.data ?? 0}
        greeting={`${greetingFor(now)}, ${name}.`}
      />
    </>
  )
}
