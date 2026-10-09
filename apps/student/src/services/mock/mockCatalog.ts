/**
 * The demo course, class, note, summary and notification services (REQUIREMENTS.md section 13).
 * They serve a seed held in memory; nothing is written to storage.
 */

// The error a missing record becomes.
import { AppError } from '@conote/core/errors'
// The mock-data key prefix.
import { MOCK_DATA_PREFIX } from '@/lib/storage'

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
// Remembered sets of IDs.
import { createPersistedIdSet } from './persistedIds'
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
  // Where demo changes (notes, viewed summaries, read notifications) are kept between reloads;
  // tests usually leave it out.
  store?: Storage
  // The IDs of the courses the student is in right now. Everything the services return is
  // narrowed to them (D76). Read on every call, because a request can be approved or a new
  // student can sign up meanwhile. Absent: every course in the seed.
  enrolledCourseIds?: () => ReadonlySet<string>
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
export function createMockCatalog({
  seed,
  latencyMs,
  store,
  enrolledCourseIds = () => new Set(seed.courses.map((course) => course.id)),
}: MockCatalogOptions): MockCatalog {
  /**
   * The seed narrowed to the courses the student is in.
   * SECURITY: a course the student hasn't joined contributes nothing, so a request that is still
   * pending (or declined) shows no classes, notes or summaries of that course.
   */
  function view(): Seed {
    const enrolled = enrolledCourseIds()
    return {
      courses: seed.courses.filter((course) => enrolled.has(course.id)),
      classes: seed.classes.filter((cls) => enrolled.has(cls.courseId)),
      notes: seed.notes.filter((note) => enrolled.has(note.courseId)),
      summaries: seed.summaries.filter((summary) => enrolled.has(summary.courseId)),
      // The demo's notifications are about its enrolled courses; a student in none has none.
      notifications: enrolled.size > 0 ? seed.notifications : [],
      catalog: seed.catalog,
    }
  }

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
  function findCourse(courseId: string) {
    // Look it up among the enrolled courses.
    const course = view().courses.find((c) => c.id === courseId)
    // Missing: the page shows its "not found" panel.
    if (!course) throw new AppError('not_found', 'Course not found')
    // Found.
    return course
  }

  // Summaries the student has opened, and notifications they have read, kept between reloads.
  const viewed = createPersistedIdSet(
    seed.summaries.filter((s) => s.viewedByMe).map((s) => s.id),
    store,
    `${MOCK_DATA_PREFIX}viewed-summaries`,
  )
  const read = createPersistedIdSet(
    seed.notifications.filter((n) => n.read).map((n) => n.id),
    store,
    `${MOCK_DATA_PREFIX}read-notifications`,
  )

  /**
   * Summaries of published classes only, with the viewed flag applied.
   * SECURITY: filters on the class's status again even though the seed holds only published
   * summaries, so an edit to the seed can never leak a draft to students (section 4).
   */
  function publishedSummaries() {
    const current = view()
    const published = new Set(
      current.classes.filter((c) => c.summaryStatus === 'published').map((c) => c.id),
    )
    return current.summaries
      .filter((s) => published.has(s.classId))
      .map((s) => ({ ...s, viewedByMe: viewed.has(s.id) }))
  }

  /** The notifications with the read flag applied. */
  function notificationsNow() {
    return view().notifications.map((n) => ({ ...n, read: read.has(n.id) }))
  }

  // The notes service over every seeded note, before it is narrowed to the enrolled courses.
  const allNotes = createMockNoteService({
    seedNotes: seed.notes,
    classes: seed.classes,
    studentId: DEMO_STUDENT_ID,
    latencyMs,
    ...(store ? { store: store } : {}),
  })

  /**
   * The notes service narrowed to the courses the student is in.
   * SECURITY: a note of a course the student isn't in is neither listed nor readable, and a new
   * note can't be added to such a course's class, whatever the address or request says.
   */
  const scopedNotes: NoteService = {
    ...allNotes,
    listMyNotes: async (filter) => {
      const enrolled = enrolledCourseIds()
      return (await allNotes.listMyNotes(filter)).filter((note) => enrolled.has(note.courseId))
    },
    getNote: async (noteId) => {
      const note = await allNotes.getNote(noteId)
      if (!enrolledCourseIds().has(note.courseId)) throw new AppError('not_found', 'Note not found')
      return note
    },
    createNote: async (input) => {
      // A class the student isn't in is not found. An unknown class is left to the notes service,
      // which rejects it with its own validation message.
      const session = seed.classes.find((cls) => cls.id === input.classId)
      if (session && !enrolledCourseIds().has(session.courseId)) {
        throw new AppError('not_found', 'Class not found')
      }
      return allNotes.createNote(input)
    },
  }

  return {
    courses: {
      // Seed order is the display order.
      listMyCourses: () => respond(view().courses),
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
        const sessions = view()
          .classes.filter((c) => c.courseId === courseId)
          .sort((a, b) => a.number - b.number)
        // Copies.
        return structuredClone(sessions)
      },
      // Every class of every enrolled course, soonest first.
      listMyClasses: () =>
        respond(
          [...view().classes].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
        ),
      // One class.
      getClass: async (classId) => {
        // Behave like a network call.
        await simulateLatency(latencyMs)
        // Look it up.
        const session = view().classes.find((c) => c.id === classId)
        // Missing: not_found.
        if (!session) throw new AppError('not_found', 'Class not found')
        // Copy.
        return structuredClone(session)
      },
    },
    // The demo student's notes, kept between reloads when a store is given, and narrowed to the
    // courses the student is in.
    notes: scopedNotes,
    summaries: {
      // Published summaries, narrowed to one course when asked, newest first.
      listPublished: (filter = {}) =>
        respond(
          newestFirst(
            publishedSummaries().filter(
              (s) => filter.courseId === undefined || s.courseId === filter.courseId,
            ),
            (s) => s.publishedAt,
          ),
        ),
      // One class's published summary.
      getByClass: async (classId) => {
        // Behave like a network call.
        await simulateLatency(latencyMs)
        // SECURITY: only a published summary is ever returned; a class still in collecting,
        // processing or review gets not_found, so no draft reaches the page (FR-SUM-6).
        const summary = publishedSummaries().find((s) => s.classId === classId)
        if (!summary) throw new AppError('not_found', 'Summary not found')
        return structuredClone(summary)
      },
      // Remember that the student opened it (FR-SUM-5).
      markViewed: async (summaryId) => {
        // Behave like a network call.
        await simulateLatency(latencyMs)
        // Only published summaries can be viewed.
        if (!publishedSummaries().some((s) => s.id === summaryId)) {
          throw new AppError('not_found', 'Summary not found')
        }
        viewed.add(summaryId)
      },
    },
    notifications: {
      // Newest first, with the remembered read state.
      list: () => respond(newestFirst(notificationsNow(), (n) => n.createdAt)),
      // Unread ones only.
      unreadCount: () => respond(notificationsNow().filter((n) => !n.read).length),
      // One read (FR-NTF-3).
      markRead: async (notificationId) => {
        // Behave like a network call.
        await simulateLatency(latencyMs)
        // Unknown: not_found.
        if (!view().notifications.some((n) => n.id === notificationId)) {
          throw new AppError('not_found', 'Notification not found')
        }
        read.add(notificationId)
      },
      // All read (FR-NTF-3).
      markAllRead: async () => {
        // Behave like a network call.
        await simulateLatency(latencyMs)
        read.add(...view().notifications.map((n) => n.id))
      },
    },
  }
}
