/**
 * A course's tinted book icon. Each course keeps one of four accent colours (REQUIREMENTS.md 6.1).
 */

// The book icon.
import { BookOpen } from 'lucide-react'

// Picks the course's accent from its ID.
import { courseAccent, type CourseAccent } from '@/lib/courseAccent'
// Class-name helper.
import { cn } from '@conote/ui/utils'

/**
 * Full class names per accent. Written out in full because Tailwind only generates classes it
 * can find as whole words in the source.
 */
const ACCENT_CLASSES: Record<CourseAccent, string> = {
  // Indigo.
  1: 'bg-course-1-soft text-course-1',
  // Green.
  2: 'bg-course-2-soft text-course-2',
  // Orange.
  3: 'bg-course-3-soft text-course-3',
  // Blue.
  4: 'bg-course-4-soft text-course-4',
}

/** The icon for `courseId`. Decorative: the course code beside it carries the meaning. */
export function CourseIcon({
  courseId,
  className,
}: Readonly<{ courseId: string; className?: string }>) {
  return (
    // Rounded tinted square; hidden from screen readers.
    <span
      aria-hidden="true"
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        ACCENT_CLASSES[courseAccent(courseId)],
        className,
      )}
    >
      {/* The icon itself. */}
      <BookOpen className="size-5" />
    </span>
  )
}
