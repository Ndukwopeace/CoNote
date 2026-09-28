/**
 * The demo course, class, note, summary and notification services (REQUIREMENTS.md section 13).
 * They serve a seed held in memory; nothing is written to storage.
 */

// The error a missing record becomes.
import { AppError } from '@/lib/errors'
// The shapes served.
import type { ID } from '@/types/domain'

// The interfaces these services implement.
import type {
  ClassService,
  CourseService,
  NoteService,
  NotificationService,
  SummaryService,
} from '../types'

// The fake network delay.
import { simulateLatency } from './latency'
// The demo note service.
import { createMockNoteService } from './mockNotes'
// The demo student every note belongs to.
import { DEMO_STUDENT_ID } from './seed/constants'
// The demo data's shape.
import type { Seed } from './seed'

/** What the factory needs. */
interface MockCatalogOptions {
  // The data to serve.
  seed: Seed
  // Delay per call; tests pass 0.
  latencyMs: number
  // Where notes are kept between reloads; tests usually leave it out.
  noteStore?: Storage
}

/** The read-only services built over one seed. */
export interface MockCatalog {
  // Enrolled courses.
  courses: CourseService
  // Class sessions.
  classes: ClassService
  // The demo student's notes.
  notes: NoteService
  // Published summaries.
  summaries: SummaryService
  // Notifications.
  notifications: NotificationService
}

/** Newest first by an ISO time field. */
function newestFirst<T>(items: readonly T[], time: (item: T) => string): T[] {
  // Copy first; sort would otherwise reorder the seed itself.
  return [...items].sort((a, b) => Date.parse(time(b)) - Date.parse(time(a)))
}

/** Builds the demo catalog services over `seed`. */
export function createMockCatalog({ seed, latencyMs, noteStore }: MockCatalogOptions): MockCatalog {
  /**
   * Waits the demo delay, then returns a deep copy of `value`.
   * Copies stop a page that edits a returned object from changing the demo data for everyone.
   */
  async function respond<T>(value: T): Promise<T> {
    // Behave like a network call.
    await simulateLatency(latencyMs)
    // A fresh copy each time.
    return structuredClone(value)
  }

  /** The course with this ID, or a not_found error. */
  function findCourse(courseId: ID) {
    // Look it up among the enrolled courses.
    const course = seed.courses.find((c) => c.id === courseId)
    // Missing: the page shows its "not found" panel.
    if (!course) throw new AppError('not_found', 'Course not found')
    // Found.
    return course
  }

  return {
    courses: {
      // Seed order is the display order.
      listMyCourses: () => respond(seed.courses),
      // One course; the lookup runs after the delay so errors arrive like a server's would.
      getCourse: async (courseId) => {
        // Behave like a network call.
        await simulateLatency(latencyMs)
        // Copy of the course, or not_found.
        return structuredClone(findCourse(courseId))
      },
    },
    classes: {
      // One course's classes by number.
      listClasses: async (courseId) => {
        // Behave like a network call.
        await simulateLatency(latencyMs)
        // An unknown course is not_found rather than an empty list, so bad links are obvious.
        findCourse(courseId)
        // That course's classes, in number order.
        const sessions = seed.classes
          .filter((c) => c.courseId === courseId)
          .sort((a, b) => a.number - b.number)
        // Copies.
        return structuredClone(sessions)
      },
      // Every class of every enrolled course, soonest first.
      listMyClasses: () =>
        respond([...seed.classes].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))),
      // One class.
      getClass: async (classId) => {
        // Behave like a network call.
        await simulateLatency(latencyMs)
        // Look it up.
        const session = seed.classes.find((c) => c.id === classId)
        // Missing: not_found.
        if (!session) throw new AppError('not_found', 'Class not found')
        // Copy.
        return structuredClone(session)
      },
    },
    // The demo student's notes, kept between reloads when a store is given.
    notes: createMockNoteService({
      seedNotes: seed.notes,
      classes: seed.classes,
      studentId: DEMO_STUDENT_ID,
      latencyMs,
      ...(noteStore ? { store: noteStore } : {}),
    }),
    summaries: {
      // SECURITY: filters to published classes again even though the seed holds only those, so
      // an edit to the seed can never leak a draft summary to students (section 4).
      listPublished: (filter = {}) => {
        // IDs of classes whose summary is published.
        const published = new Set(
          seed.classes.filter((c) => c.summaryStatus === 'published').map((c) => c.id),
        )
        // Published summaries, narrowed to one course when asked.
        const summaries = seed.summaries.filter(
          (s) =>
            published.has(s.classId) &&
            (filter.courseId === undefined || s.courseId === filter.courseId),
        )
        // Newest first.
        return respond(newestFirst(summaries, (s) => s.publishedAt))
      },
    },
    notifications: {
      // Newest first.
      list: () => respond(newestFirst(seed.notifications, (n) => n.createdAt)),
      // Unread ones only.
      unreadCount: () => respond(seed.notifications.filter((n) => !n.read).length),
    },
  }
}
