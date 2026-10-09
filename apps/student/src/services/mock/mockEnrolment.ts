/**
 * The demo enrolment service (FR-ENR, D76): which courses the demo student is in, and the requests
 * to join more. The state lives in the browser's storage under the mock-data prefix, so it
 * survives a reload and "Reset demo data" clears it. An admin's approval happens in another app
 * (a separate origin in the demo), so here `decide` stands in for it, for tests and the contract.
 */

// Checks stored state before it is used.
import { z } from 'zod'

// The error type every failure becomes.
import { AppError } from '@conote/core/errors'
// The mock-data key prefix.
import { MOCK_DATA_PREFIX } from '@/lib/storage'
// Shapes.
import type { CourseStatus, JoinableCourse, JoinRequest } from '@/types/domain'

// The interface implemented.
import type { EnrolmentService } from '../types'

// The fake network delay.
import { simulateLatency } from './latency'

/** Where the demo keeps the student's enrolments and requests. */
export const MOCK_ENROLMENT_KEY = `${MOCK_DATA_PREFIX}enrolment`

/** A course on the platform, as the join dialog sees it. */
export interface CatalogCourse {
  id: string
  code: string
  title: string
  teacherName: string
  status: CourseStatus
  // Archived courses are never listed or open to requests.
  archived: boolean
}

/** What the factory needs. */
interface MockEnrolmentOptions {
  // Every course on the platform.
  catalog: readonly CatalogCourse[]
  // The courses the student is in when nothing is stored.
  initialEnrolledIds: readonly string[]
  // Delay per call; tests pass 0.
  latencyMs: number
  // Optional persistence; tests usually leave it out.
  store?: Storage
  // The clock; tests can pin it.
  now?: () => Date
}

/**
 * The shape stored state must have.
 * SECURITY: localStorage can be edited in developer tools. Anything that doesn't match is ignored
 * and the demo starts from its initial state again, rather than enrolling the student in a course
 * by hand-editing storage into something the pages trust.
 */
const storedStateSchema = z.object({
  enrolledCourseIds: z.array(z.string()),
  requests: z.array(
    z.object({
      id: z.string(),
      courseId: z.string(),
      status: z.enum(['pending', 'approved', 'declined', 'cancelled']),
      createdAt: z.string(),
    }),
  ),
})

/** The student's enrolments and every request they have made. */
type State = z.infer<typeof storedStateSchema>

/** The message for a course that can't take a request, whatever the reason. */
const NOT_OPEN = "This course isn't open for requests."

/**
 * Makes the demo student a new one: in no courses, with no requests. Called when someone signs up,
 * so the "Join your courses" dialog has something to do (D76).
 */
export function startNewStudent(store: Storage) {
  const empty: State = { enrolledCourseIds: [], requests: [] }
  store.setItem(MOCK_ENROLMENT_KEY, JSON.stringify(empty))
}

/** What `createMockEnrolment` returns. */
export interface MockEnrolment {
  // The service the app uses.
  service: EnrolmentService
  // The IDs of the courses the student is in right now.
  enrolledIds: () => ReadonlySet<string>
  // Stands in for an admin's decision on a request.
  decide: (requestId: string, decision: 'approved' | 'declined') => Promise<void>
}

/** Builds the demo enrolment service over `catalog`. */
export function createMockEnrolment({
  catalog,
  initialEnrolledIds,
  latencyMs,
  store,
  now = () => new Date(),
}: MockEnrolmentOptions): MockEnrolment {
  // Used when there is no store: the state lives in this variable.
  let memory: State = { enrolledCourseIds: [...initialEnrolledIds], requests: [] }

  /** The current state. Read each time, because another part of the demo may change it. */
  function read(): State {
    // No store: the in-memory state.
    if (!store) return memory
    // Nothing stored: the initial state.
    const raw = store.getItem(MOCK_ENROLMENT_KEY)
    if (raw === null) return { enrolledCourseIds: [...initialEnrolledIds], requests: [] }
    // SECURITY: stored text is checked before use; anything odd means the initial state.
    try {
      const parsed = storedStateSchema.safeParse(JSON.parse(raw))
      if (parsed.success) return parsed.data
    } catch {
      // Not JSON: handled below like any other malformed value.
    }
    return { enrolledCourseIds: [...initialEnrolledIds], requests: [] }
  }

  /** Saves `state`. */
  function write(state: State) {
    if (store) store.setItem(MOCK_ENROLMENT_KEY, JSON.stringify(state))
    else memory = state
  }

  /** Courses in use: ongoing or upcoming, and not archived. */
  function isOpen(course: CatalogCourse) {
    return !course.archived && course.status !== 'completed'
  }

  /** The latest request for `courseId`, if any (the list is in the order they were made). */
  function latestFor(state: State, courseId: string) {
    return state.requests.findLast((request) => request.courseId === courseId)
  }

  /** The course on the platform with this ID. */
  function courseById(courseId: string) {
    return catalog.find((course) => course.id === courseId)
  }

  /** A request as the student sees it. */
  function toJoinRequest(
    request: State['requests'][number],
    status: 'pending' | 'declined',
  ): JoinRequest {
    const course = courseById(request.courseId)
    return {
      id: request.id,
      courseId: request.courseId,
      courseCode: course?.code ?? '',
      courseTitle: course?.title ?? '',
      status,
      createdAt: request.createdAt,
    }
  }

  /** Waits the demo delay, as a network call would. */
  async function wait() {
    await simulateLatency(latencyMs)
  }

  const service: EnrolmentService = {
    async listJoinableCourses(query = '') {
      await wait()
      const state = read()
      const needle = query.trim().toLowerCase()
      return catalog
        .filter(isOpen)
        .filter(
          (course) =>
            needle === '' ||
            course.code.toLowerCase().includes(needle) ||
            course.title.toLowerCase().includes(needle),
        )
        .map((course): JoinableCourse => {
          // Already in: nothing more to do.
          const enrolled = state.enrolledCourseIds.includes(course.id)
          // Otherwise the latest request decides.
          const latest = latestFor(state, course.id)
          const pending = !enrolled && latest?.status === 'pending' ? latest : undefined
          let membership: JoinableCourse['membership'] = 'none'
          if (enrolled) membership = 'enrolled'
          else if (pending) membership = 'pending'
          else if (latest?.status === 'declined') membership = 'declined'
          return {
            id: course.id,
            code: course.code,
            title: course.title,
            teacherName: course.teacherName,
            status: course.status,
            membership,
            requestId: pending?.id ?? null,
          }
        })
    },

    async listMyJoinRequests() {
      await wait()
      const state = read()
      // One entry per course: its latest request, if that is still pending or declined.
      const shown: JoinRequest[] = []
      for (const course of catalog) {
        const latest = latestFor(state, course.id)
        if (latest?.status === 'pending' || latest?.status === 'declined') {
          shown.push(toJoinRequest(latest, latest.status))
        }
      }
      // Newest first; requests made in the same instant keep the later one on top.
      const order = new Map(state.requests.map((request, index) => [request.id, index]))
      return shown.sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0),
      )
    },

    async requestToJoin(courseId) {
      await wait()
      const state = read()
      const course = courseById(courseId)
      // SECURITY: an unknown, archived or completed course all answer the same, so the answer
      // reveals nothing about which course IDs exist.
      if (!course || !isOpen(course)) throw new AppError('validation', NOT_OPEN)
      // Already in the course.
      if (state.enrolledCourseIds.includes(courseId)) {
        throw new AppError('conflict', "You're already in this course.")
      }
      // One open request per course.
      if (latestFor(state, courseId)?.status === 'pending') {
        throw new AppError('conflict', "You've already asked to join this course.")
      }
      // Record it, pending, until an admin decides.
      const request = {
        id: crypto.randomUUID(),
        courseId,
        status: 'pending' as const,
        createdAt: now().toISOString(),
      }
      write({ ...state, requests: [...state.requests, request] })
      return toJoinRequest(request, 'pending')
    },

    async cancelJoinRequest(requestId) {
      await wait()
      const state = read()
      const request = state.requests.find((candidate) => candidate.id === requestId)
      if (!request) throw new AppError('not_found', 'Request not found')
      // Only a request still waiting can be withdrawn.
      if (request.status !== 'pending') {
        throw new AppError('conflict', 'This request has already been decided.')
      }
      write({
        ...state,
        requests: state.requests.map((candidate) =>
          candidate.id === requestId ? { ...candidate, status: 'cancelled' as const } : candidate,
        ),
      })
    },
  }

  return {
    service,
    enrolledIds: () => new Set(read().enrolledCourseIds),
    decide: async (requestId, decision) => {
      await wait()
      const state = read()
      const request = state.requests.find((candidate) => candidate.id === requestId)
      if (request?.status !== 'pending') {
        throw new AppError('conflict', 'This request has already been decided.')
      }
      write({
        // Approval enrols the student, as the admin console does.
        enrolledCourseIds:
          decision === 'approved'
            ? [...state.enrolledCourseIds, request.courseId]
            : state.enrolledCourseIds,
        requests: state.requests.map((candidate) =>
          candidate.id === requestId ? { ...candidate, status: decision } : candidate,
        ),
      })
    },
  }
}
