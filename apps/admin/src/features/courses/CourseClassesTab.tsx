/**
 * The Classes tab (admin REQUIREMENTS section 12): the course's sessions, oldest first, each with
 * its summary stage.
 */

// Client-side links.
import { Link } from 'react-router'

// Badges and empty states.
import { Badge } from '@conote/ui/badge'

// Dates.
import { formatDate } from '@/lib/format'
// Detail page addresses.
import { routeTo } from '@/lib/routes'
// Summary stage wording.
import { summaryStatusLabel } from '@/lib/summaryStatus'
// The course shape.
import type { CourseClass } from '@/types/courses'

/** The Classes tab. */
export function CourseClassesTab({ classes }: Readonly<{ classes: CourseClass[] }>) {
  // Nothing yet.
  if (classes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No classes have been added to this course.</p>
    )
  }
  return (
    <ul aria-label="Classes" className="divide-y rounded-xl border bg-card text-sm">
      {classes.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div>
            <Link to={routeTo.class(item.id)} className="font-medium hover:underline">
              {item.title}
            </Link>
            <span className="block text-muted-foreground">{formatDate(item.startsAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            {item.archived && <Badge variant="outline">Archived</Badge>}
            <Badge variant={item.summaryStatus === 'published' ? 'success' : 'outline'}>
              {summaryStatusLabel(item.summaryStatus)}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  )
}
