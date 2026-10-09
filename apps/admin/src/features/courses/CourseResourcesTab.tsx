/**
 * The Resources tab (admin REQUIREMENTS section 12): the files and links attached to the course.
 */

// Client-side links.
import { Link } from 'react-router'

// Badges.
import { Badge } from '@conote/ui/badge'

// Detail page addresses.
import { routeTo } from '@/lib/routes'
// The course shape.
import type { CourseResource } from '@/types/courses'

/** The Resources tab. */
export function CourseResourcesTab({ resources }: Readonly<{ resources: CourseResource[] }>) {
  // Nothing yet.
  if (resources.length === 0) {
    return <p className="text-sm text-muted-foreground">No resources have been added.</p>
  }
  return (
    <ul aria-label="Resources" className="divide-y rounded-xl border bg-card text-sm">
      {resources.map((resource) => (
        <li key={resource.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div>
            <Link to={routeTo.resource(resource.id)} className="font-medium hover:underline">
              {resource.title}
            </Link>
            {/* The class it belongs to, if any. */}
            {resource.classTitle && (
              <span className="block text-muted-foreground">{resource.classTitle}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {resource.type}
            </Badge>
            <Badge
              variant={resource.status === 'published' ? 'success' : 'outline'}
              className="capitalize"
            >
              {resource.status}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  )
}
