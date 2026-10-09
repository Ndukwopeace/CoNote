/**
 * A course's status as a tinted label (admin REQUIREMENTS section 21, StatusBadge). The word is
 * always shown, so colour is never the only signal. An archived course shows "Archived" instead.
 */

// The shared vocabulary.
import type { CourseStatus } from '@conote/domain'
// The badge.
import { Badge } from '@conote/ui/badge'

// Status wording.
import { courseStatusLabel } from '@/lib/courseStatus'

/** The badge colour for each status. */
const VARIANTS = {
  upcoming: 'warning',
  ongoing: 'success',
  completed: 'outline',
} as const satisfies Record<CourseStatus, string>

/** What the badge shows. */
interface CourseStatusBadgeProps {
  status: CourseStatus
  // When the course was archived, or null while it is in use.
  archivedAt: string | null
}

/** The status label, or "Archived". */
export function CourseStatusBadge({ status, archivedAt }: Readonly<CourseStatusBadgeProps>) {
  // Archived trumps the term status: it is what decides whether the course can change.
  if (archivedAt !== null) return <Badge variant="outline">Archived</Badge>
  return <Badge variant={VARIANTS[status]}>{courseStatusLabel(status)}</Badge>
}
