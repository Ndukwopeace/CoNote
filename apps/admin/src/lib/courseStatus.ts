/**
 * Course status wording, the same on every screen.
 */

// The shared vocabulary.
import type { CourseStatus } from '@conote/domain'

/** Each course status in words. */
const LABELS: Record<CourseStatus, string> = {
  upcoming: 'Upcoming',
  ongoing: 'Ongoing',
  completed: 'Completed',
}

/** The statuses, in the order a filter or form lists them. */
export const COURSE_STATUSES: readonly CourseStatus[] = ['upcoming', 'ongoing', 'completed']

/** "Ongoing" for `ongoing`, and so on. */
export function courseStatusLabel(status: CourseStatus): string {
  return LABELS[status]
}
