/**
 * One dashboard number that links to its list (FR-DSH-2).
 */

// Icon component type.
import type { LucideIcon } from 'lucide-react'
// Client-side link.
import { Link } from 'react-router'

/** What a stat card shows. */
interface StatCardProps {
  // What is counted, e.g. "My Courses".
  label: string
  // The count.
  value: number
  // Decorative icon.
  icon: LucideIcon
  // The list it opens.
  to: string
}

/** A card-sized link: big number, label underneath, icon in the corner. */
export function StatCard({ label, value, icon: Icon, to }: Readonly<StatCardProps>) {
  return (
    // The whole card is the link, a large target (Fitts's law). Its name reads "4 My Courses".
    <Link
      to={to}
      className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4 transition-colors outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span>
        {/* The number. */}
        <span className="block text-2xl font-bold">{value}</span>{' '}
        {/* The label. The space above keeps the link's name "4 My Courses", not "4My Courses". */}
        <span className="block text-sm text-muted-foreground">{label}</span>
      </span>
      {/* Decorative icon in a soft brand square. */}
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary-light text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
    </Link>
  )
}
