/**
 * The dashboard (admin REQUIREMENTS section 10): a greeting, the platform's counts, one activity
 * chart, alerts and system health. Each part loads, fails and retries on its own.
 */

// Sets the tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'

// The dashboard's parts.
import { ActivityCard } from '@/features/dashboard/ActivityCard'
import { AlertList } from '@/features/dashboard/AlertList'
import { StatGrid } from '@/features/dashboard/StatGrid'
import { SystemHealthCard } from '@/features/dashboard/SystemHealthCard'
// The signed-in administrator.
import { useAuth } from '@/features/auth/useAuth'
// The greeting.
import { firstName, greeting } from '@/lib/greeting'

/** Dashboard. */
export function DashboardPage() {
  // The administrator's name; the guard guarantees a session here.
  const { session } = useAuth()
  const name = firstName(session?.user.fullName ?? '')
  // "Good morning, Amara", or just "Good morning" without a name.
  const heading = name ? `${greeting(new Date())}, ${name}` : greeting(new Date())

  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title="Dashboard" />
      {/* Greeting and subtitle. */}
      <header>
        <h1 className="text-2xl font-bold">{heading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here’s an overview of your CoNote platform.
        </p>
      </header>
      {/* The six counts. */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Platform statistics
        </h2>
        <StatGrid />
      </section>
      {/* Alerts first: the things to act on. */}
      <AlertList />
      {/* The chart beside the health card on wide screens; stacked on smaller ones. */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityCard />
        </div>
        <SystemHealthCard />
      </div>
    </div>
  )
}
