/**
 * Says "Ongoing" while one of a course's classes is going on, and nothing otherwise (D120). There
 * is no "Upcoming" or "Completed": a status that is not about this moment goes out of date. The
 * word is shown, so colour is never the only signal (NFR-2).
 */

// The badge.
import { Badge } from '@conote/ui/badge'

/** The "Ongoing" label, or nothing when no class is going on. */
export function CourseStatusBadge({ inSession }: Readonly<{ inSession: boolean }>) {
  // Nothing to say between classes.
  if (!inSession) return null
  return <Badge variant="success">Ongoing</Badge>
}
