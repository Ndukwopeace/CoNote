/**
 * The Ask AI context (FR-AI-2): read from the address, and encoded for the picker.
 */

// Shapes.
import type { AiContext, ClassSession, Course } from '@/types/domain'

/** Only IDs in these lists count. */
type Known = readonly Pick<Course, 'id'>[]
type KnownClasses = readonly Pick<ClassSession, 'id' | 'courseId'>[]

/** The context for a class ID, if it is one of the student's. */
function classContext(classId: string | null, classes: KnownClasses): AiContext | null {
  const session = classes.find((c) => c.id === classId)
  return session ? { scope: 'class', courseId: session.courseId, classId: session.id } : null
}

/** The context for a course ID, if it is one of the student's. */
function courseContext(courseId: string | null, courses: Known): AiContext | null {
  const course = courses.find((c) => c.id === courseId)
  return course ? { scope: 'course', courseId: course.id } : null
}

/**
 * The context from ?classId= or ?courseId= (class first), else everything.
 * SECURITY: only the student's own courses and classes are accepted, so a crafted link can't
 * aim the AI at material the student isn't enrolled in.
 */
export function contextFromParams(
  params: URLSearchParams,
  courses: Known,
  classes: KnownClasses,
): AiContext {
  return (
    classContext(params.get('classId'), classes) ??
    courseContext(params.get('courseId'), courses) ?? { scope: 'all' }
  )
}

/** The picker value for a context: "all", "course:ID" or "class:ID". */
export function contextKey(context: AiContext): string {
  if (context.scope === 'class') return `class:${context.classId ?? ''}`
  if (context.scope === 'course') return `course:${context.courseId ?? ''}`
  return 'all'
}

/** The context for a picker value; anything unknown is "all". */
export function parseContextKey(key: string, courses: Known, classes: KnownClasses): AiContext {
  // Split "kind:id" once.
  const [kind, id = null] = key.split(/:(.*)/s)
  if (kind === 'class') return classContext(id, classes) ?? { scope: 'all' }
  if (kind === 'course') return courseContext(id, courses) ?? { scope: 'all' }
  return { scope: 'all' }
}

/** The query string that reopens the page on this context. */
export function contextSearch(context: AiContext): string {
  if (context.scope === 'class' && context.classId)
    return `?classId=${encodeURIComponent(context.classId)}`
  if (context.scope === 'course' && context.courseId)
    return `?courseId=${encodeURIComponent(context.courseId)}`
  return ''
}
