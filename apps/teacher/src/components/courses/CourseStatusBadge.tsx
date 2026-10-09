/**
 * A course's status as a tinted label. The word is always shown, so colour is never the only
 * signal (NFR-2).
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

/** The status label. */
export function CourseStatusBadge({ status }: Readonly<{ status: CourseStatus }>) {
  return <Badge variant={VARIANTS[status]}>{courseStatusLabel(status)}</Badge>
}
