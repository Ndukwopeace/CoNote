/**
 * The dashboard's six counts (admin REQUIREMENTS section 10), each a link to the list it counts.
 */

// Icons for each count.
import {
  BookOpen,
  CalendarDays,
  Cpu,
  FileCheck2,
  GraduationCap,
  Presentation,
  type LucideIcon,
} from 'lucide-react'

// The shared stat card, and loading blocks.
import { StatCard } from '@conote/ui/common/StatCard'
import { Skeleton } from '@conote/ui/skeleton'

// Load-failure panel.
import { ErrorState } from '@conote/portal'
// The counts.
import { useOverview } from '@/hooks/useDashboard'
// Route constants and the query helper.
import { ADMIN_ROUTES, withQuery } from '@/lib/routes'
// The counts' shape.
import type { PlatformOverview } from '@/types/dashboard'

/** Each card: the count it shows, its label, its icon, and the list it opens. */
const CARDS: readonly {
  key: keyof PlatformOverview
  label: string
  icon: LucideIcon
  to: string
}[] = [
  {
    key: 'students',
    label: 'Students',
    icon: GraduationCap,
    to: withQuery(ADMIN_ROUTES.users, { role: 'student' }),
  },
  {
    key: 'teachers',
    label: 'Teachers',
    icon: Presentation,
    to: withQuery(ADMIN_ROUTES.users, { role: 'teacher' }),
  },
  { key: 'activeCourses', label: 'Active courses', icon: BookOpen, to: ADMIN_ROUTES.courses },
  {
    key: 'classesThisTerm',
    label: 'Classes this term',
    icon: CalendarDays,
    to: withQuery(ADMIN_ROUTES.classes, { term: 'current' }),
  },
  {
    key: 'publishedSummaries',
    label: 'Published summaries',
    icon: FileCheck2,
    to: withQuery(ADMIN_ROUTES.aiSummaries, { status: 'published' }),
  },
  {
    key: 'activeAiJobs',
    label: 'AI jobs running or queued',
    icon: Cpu,
    to: withQuery(ADMIN_ROUTES.aiSummaries, { job: 'active' }),
  },
]

/** The grid's columns: two on phones, three on tablets, six on wide screens. */
const GRID = 'grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6'

/** The six counts, with loading and error states. */
export function StatGrid() {
  // The counts.
  const { data, isPending, isError, refetch } = useOverview()

  // Failed: the message and a retry.
  if (isError) return <ErrorState thing="platform statistics" onRetry={() => void refetch()} />

  // Loading: six card-shaped blocks, announced once.
  if (isPending) {
    return (
      <output aria-label="Loading platform statistics" className={GRID}>
        {CARDS.map((card) => (
          <Skeleton key={card.key} className="h-[86px] rounded-xl" />
        ))}
      </output>
    )
  }

  // Loaded: the cards.
  return (
    <div className={GRID}>
      {CARDS.map((card) => (
        <StatCard
          key={card.key}
          label={card.label}
          value={data[card.key]}
          icon={card.icon}
          to={card.to}
        />
      ))}
    </div>
  )
}
