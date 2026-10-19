/**
 * The demo ProgrammeService (D105): programmes in the demo platform, and the timetable import,
 * following the same rules as the database's `import_timetable` function. A real import is all or
 * nothing: every rule is checked before anything is changed. It writes an audit entry, and
 * `onChange` lets the app save the platform so changes survive a reload.
 */

// The shared error type.
import { AppError } from '@conote/core/errors'

// The course code's stored form, and the pattern the form enforces.
import { normalizeCourseCode } from '@/lib/courseSchemas'
// What the import receives.
import type { ImportPayload } from '@/lib/timetable/payload'
// Local times in a named zone.
import { isValidTimeZone, localToIso } from '@/lib/timetable/zonedTime'
// Programme shapes.
import type { ImportOutcome, ProgrammeListItem } from '@/types/programmes'

// The records it reads and writes.
import type { ClassRecord, CourseRecord, PlatformData, ProgrammeRecord } from '../platformData'
// The interface implemented here.
import type { ProgrammeService } from '../types'

// Fake network delay.
import { simulateLatency } from './latency'

/** What an unusable teacher gets told. */
const TEACHER_MESSAGE = 'Choose an active teacher.'
/** What a file that breaks the rules gets told, with the reason after it. */
const PAYLOAD_MESSAGE = "The timetable can't be imported: "
/** A course code, once normalised: letters, a space, three digits and maybe a letter. */
const CODE_PATTERN = /^[A-Z]{2,5} \d{3}[A-Z]?$/
/** A programme code. */
const PROGRAMME_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,19}$/

/** What the demo service needs. */
interface MockProgrammeOptions {
  // The platform's records; changes are made to it directly.
  data: PlatformData
  now: () => Date
  // The signed-in administrator's ID, or null when nobody is signed in.
  actorId: () => string | null
  latencyMs: number
  // Called after every change, so the app can save the platform.
  onChange?: () => void
}

/** Throws the "can't be imported" validation error with `reason`. */
function refuse(reason: string): never {
  throw new AppError('validation', `${PAYLOAD_MESSAGE}${reason}`)
}

/** Everything an import would change, worked out before anything is saved. */
interface Draft {
  outcome: ImportOutcome
  newCourses: CourseRecord[]
  newClasses: ClassRecord[]
  newProgrammes: ProgrammeRecord[]
  newLinks: { programmeId: string; courseId: string }[]
  // Teachers to fill in on courses that exist and have none.
  teacherFills: Map<string, string>
}

/** A course by code: one that exists, or one this import has made. */
function courseByCode(data: PlatformData, draft: Draft, code: string) {
  return [...data.courses, ...draft.newCourses].find(
    (course) => normalizeCourseCode(course.code) === code,
  )
}

/** A new course is upcoming before its first class and completed after its last. */
function courseStatus(starts: string[], ends: string[], nowIso: string): CourseRecord['status'] {
  if (starts.every((start) => nowIso < start)) return 'upcoming'
  if (ends.every((end) => nowIso > end)) return 'completed'
  return 'ongoing'
}

/** Refuses a teacher who is not an active teacher. */
function checkTeacher(data: PlatformData, teacherId: string | null) {
  if (teacherId === null) return
  const teacher = data.users.find((user) => user.id === teacherId)
  if (teacher?.role !== 'teacher' || teacher.status !== 'active') {
    throw new AppError('validation', TEACHER_MESSAGE)
  }
}

/** Adds a course that exists already (keeping its details) or makes a new one. */
function addCourse(
  data: PlatformData,
  draft: Draft,
  entry: ImportPayload['courses'][number],
  code: string,
  title: string,
  options: { timezone: string; nowIso: string },
): CourseRecord {
  const existing = courseByCode(data, draft, code)
  if (existing) {
    draft.outcome.coursesExisting += 1
    // A teacher is filled in only where the course has none.
    if (
      entry.teacherId !== null &&
      existing.teacherId === null &&
      !draft.teacherFills.has(existing.id)
    ) {
      draft.teacherFills.set(existing.id, entry.teacherId)
      draft.outcome.teachersAssigned += 1
    }
    return existing
  }
  const starts = entry.sessions.map((session) => localToIso(session.start, options.timezone))
  const ends = entry.sessions.map((session) => localToIso(session.end, options.timezone))
  const course: CourseRecord = {
    id: `course-${crypto.randomUUID()}`,
    code,
    title,
    description: '',
    department: null,
    status: courseStatus(starts, ends, options.nowIso),
    teacherId: entry.teacherId,
    createdAt: options.nowIso,
    archivedAt: null,
  }
  draft.newCourses.push(course)
  draft.outcome.coursesCreated += 1
  if (entry.teacherId !== null) draft.outcome.teachersAssigned += 1
  return course
}

/** Adds a course's classes; one that already starts at the same moment is left as it is. */
function addSessions(
  data: PlatformData,
  draft: Draft,
  course: CourseRecord,
  sessions: ImportPayload['courses'][number]['sessions'],
  timezone: string,
) {
  for (const session of sessions) {
    const startsAt = localToIso(session.start, timezone)
    const endsAt = localToIso(session.end, timezone)
    const name = session.title.trim()
    if (endsAt <= startsAt || name === '' || name.length > 150) {
      refuse(`a class of ${course.code} needs a title and must end after it starts.`)
    }
    const known = [...data.classes, ...draft.newClasses].filter(
      (item) => item.courseId === course.id,
    )
    if (known.some((item) => item.startsAt === startsAt)) {
      draft.outcome.classesSkipped += 1
      continue
    }
    // Numbered after the course's last class, archived ones counted.
    const last = Math.max(0, ...known.map((item) => item.number))
    draft.newClasses.push({
      id: `class-${crypto.randomUUID()}`,
      courseId: course.id,
      number: last + 1,
      title: name,
      description: '',
      startsAt,
      endsAt,
      noteCount: 0,
      archivedAt: null,
    })
    draft.outcome.classesCreated += 1
  }
}

/** Adds a programme, or finds it, and links the courses it names. */
function addProgramme(
  data: PlatformData,
  draft: Draft,
  entry: ImportPayload['programmes'][number],
  nowIso: string,
) {
  const code = entry.code.trim()
  const name = entry.name.trim()
  if (!PROGRAMME_CODE_PATTERN.test(code) || name === '' || name.length > 100) {
    refuse('a programme needs a code and a name.')
  }
  let programme = [...data.programmes, ...draft.newProgrammes].find(
    (candidate) => candidate.code.toLowerCase() === code.toLowerCase(),
  )
  if (programme) {
    draft.outcome.programmesExisting += 1
  } else {
    programme = {
      id: `programme-${crypto.randomUUID()}`,
      code,
      name,
      openEnrolment: true,
      createdAt: nowIso,
    }
    draft.newProgrammes.push(programme)
    draft.outcome.programmesCreated += 1
  }
  for (const courseCode of entry.courseCodes) {
    const course = courseByCode(data, draft, normalizeCourseCode(courseCode))
    if (!course) refuse('a programme names a course that does not exist.')
    const programmeId = programme.id
    const linked = [...data.programmeCourses, ...draft.newLinks].some(
      (link) => link.programmeId === programmeId && link.courseId === course.id,
    )
    if (!linked) draft.newLinks.push({ programmeId, courseId: course.id })
  }
}

/** Works out what `payload` would change, refusing it whole if any rule breaks. */
function buildDraft(data: PlatformData, payload: ImportPayload, nowIso: string): Draft {
  if (!isValidTimeZone(payload.timezone)) refuse('the time zone is not known.')
  const draft: Draft = {
    outcome: {
      programmesCreated: 0,
      programmesExisting: 0,
      coursesCreated: 0,
      coursesExisting: 0,
      classesCreated: 0,
      classesSkipped: 0,
      teachersAssigned: 0,
    },
    newCourses: [],
    newClasses: [],
    newProgrammes: [],
    newLinks: [],
    teacherFills: new Map(),
  }
  for (const entry of payload.courses) {
    const code = normalizeCourseCode(entry.code)
    const title = entry.title.trim()
    if (!CODE_PATTERN.test(code)) refuse(`"${entry.code}" is not a course code like SWE 311.`)
    if (title === '' || title.length > 150) refuse(`${code} needs a title.`)
    checkTeacher(data, entry.teacherId)
    const course = addCourse(data, draft, entry, code, title, {
      timezone: payload.timezone,
      nowIso,
    })
    addSessions(data, draft, course, entry.sessions, payload.timezone)
  }
  // Programmes, once their courses exist.
  for (const entry of payload.programmes) addProgramme(data, draft, entry, nowIso)
  return draft
}

/** Builds the demo ProgrammeService over `data`. */
export function createMockProgrammeService({
  data,
  now,
  actorId,
  latencyMs,
  onChange,
}: MockProgrammeOptions): ProgrammeService {
  /** The signed-in administrator's ID. SECURITY: no change is made without one. */
  function requireActor(): string {
    const id = actorId()
    if (!id) throw new AppError('unauthorized', 'Sign in again to continue.')
    return id
  }

  /** The list row for `programme`. */
  function toListItem(programme: ProgrammeRecord): ProgrammeListItem {
    return {
      id: programme.id,
      code: programme.code,
      name: programme.name,
      openEnrolment: programme.openEnrolment,
      courseCount: data.programmeCourses.filter((link) => link.programmeId === programme.id).length,
      studentCount: data.programmeMembers.filter((member) => member.programmeId === programme.id)
        .length,
      pendingRequestCount: data.programmeRequests.filter(
        (request) => request.programmeId === programme.id && request.status === 'pending',
      ).length,
    }
  }

  return {
    async listProgrammes() {
      await simulateLatency(latencyMs)
      return data.programmes
        .map(toListItem)
        .sort((a, b) => a.code.localeCompare(b.code, 'en', { sensitivity: 'base' }))
    },

    async setEnrolmentOpen(programmeId, open) {
      await simulateLatency(latencyMs)
      requireActor()
      const programme = data.programmes.find((candidate) => candidate.id === programmeId)
      if (!programme) throw new AppError('not_found', 'Programme not found.')
      programme.openEnrolment = open
      onChange?.()
      return toListItem(programme)
    },

    async listProgrammeRequests() {
      await simulateLatency(latencyMs)
      return data.programmeRequests
        .filter((request) => request.status === 'pending')
        .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))
        .flatMap((request) => {
          const programme = data.programmes.find(
            (candidate) => candidate.id === request.programmeId,
          )
          const student = data.users.find((user) => user.id === request.studentId)
          // A request whose programme or student is gone cannot be shown or acted on.
          if (!programme || !student) return []
          return [
            {
              id: request.id,
              programmeId: programme.id,
              programmeCode: programme.code,
              programmeName: programme.name,
              studentId: student.id,
              studentName: student.fullName,
              studentEmail: student.email,
              createdAt: request.createdAt,
            },
          ]
        })
    },

    async decideProgrammeRequest(requestId, decision) {
      await simulateLatency(latencyMs)
      const actor = requireActor()
      const request = data.programmeRequests.find((candidate) => candidate.id === requestId)
      if (!request) throw new AppError('not_found', 'Request not found.')
      if (request.status !== 'pending') {
        throw new AppError('conflict', 'This request has already been decided.')
      }
      if (decision === 'approved') {
        const student = data.users.find((user) => user.id === request.studentId)
        // SECURITY: only an active student can be enrolled, whatever the request says.
        if (student?.role !== 'student' || student.status !== 'active') {
          throw new AppError('validation', "This account can't join a programme.")
        }
        // One programme per student, checked at the moment of approval.
        const current = data.programmeMembers.find(
          (member) => member.studentId === request.studentId,
        )
        if (current && current.programmeId !== request.programmeId) {
          throw new AppError('conflict', 'This student is already in a programme.')
        }
        // Enrol in every course of the programme in use; a course already joined is skipped.
        for (const link of data.programmeCourses.filter(
          (candidate) => candidate.programmeId === request.programmeId,
        )) {
          const course = data.courses.find((candidate) => candidate.id === link.courseId)
          const joined = data.enrollments.some(
            (enrollment) =>
              enrollment.courseId === link.courseId && enrollment.studentId === request.studentId,
          )
          if (course?.archivedAt === null && course.status !== 'completed' && !joined) {
            data.enrollments.push({ courseId: link.courseId, studentId: request.studentId })
          }
        }
        if (!current) {
          data.programmeMembers.push({
            programmeId: request.programmeId,
            studentId: request.studentId,
          })
        }
      }
      request.status = decision
      data.auditLog.push({
        id: `audit-${crypto.randomUUID()}`,
        at: now().toISOString(),
        actorId: actor,
        action: 'programme_requests.update',
        entityType: 'programme_requests',
        entityId: request.id,
        metadata: { changed: 'status' },
      })
      onChange?.()
    },

    async listProgrammeMembers(programmeId) {
      await simulateLatency(latencyMs)
      return data.programmeMembers
        .filter((member) => member.programmeId === programmeId)
        .flatMap((member) => {
          const student = data.users.find((user) => user.id === member.studentId)
          return student
            ? [
                {
                  studentId: student.id,
                  studentName: student.fullName,
                  studentEmail: student.email,
                },
              ]
            : []
        })
        .sort((a, b) => a.studentName.localeCompare(b.studentName))
    },

    async removeFromProgramme(studentId) {
      await simulateLatency(latencyMs)
      const actor = requireActor()
      const member = data.programmeMembers.find((candidate) => candidate.studentId === studentId)
      if (!member) throw new AppError('not_found', "This student isn't in a programme.")
      // They leave the programme's courses; their notes are not touched.
      const leaving = new Set(
        data.programmeCourses
          .filter((link) => link.programmeId === member.programmeId)
          .map((link) => link.courseId),
      )
      const before = data.enrollments.length
      data.enrollments = data.enrollments.filter(
        (enrollment) => !(enrollment.studentId === studentId && leaving.has(enrollment.courseId)),
      )
      data.programmeMembers = data.programmeMembers.filter(
        (candidate) => candidate.studentId !== studentId,
      )
      const removed = before - data.enrollments.length
      // Recorded with a count and nothing else.
      data.auditLog.push({
        id: `audit-${crypto.randomUUID()}`,
        at: now().toISOString(),
        actorId: actor,
        action: 'programme_members.remove',
        entityType: 'programme_members',
        entityId: studentId,
        metadata: { coursesRemoved: String(removed) },
      })
      onChange?.()
      return removed
    },

    async importTimetable(payload: ImportPayload, { dryRun }) {
      await simulateLatency(latencyMs)
      const actor = requireActor()
      // Everything is worked out first and only saved at the end, so a refused file leaves
      // nothing behind.
      const draft = buildDraft(data, payload, now().toISOString())
      // A dry run ends here with nothing changed.
      if (dryRun) return draft.outcome

      // Every rule held: save it all, and record it with counts only.
      for (const [courseId, teacherId] of draft.teacherFills) {
        const course = data.courses.find((candidate) => candidate.id === courseId)
        if (course) course.teacherId = teacherId
      }
      data.courses.push(...draft.newCourses)
      data.classes.push(...draft.newClasses)
      data.programmes.push(...draft.newProgrammes)
      data.programmeCourses.push(...draft.newLinks)
      data.auditLog.push({
        id: `audit-${crypto.randomUUID()}`,
        at: now().toISOString(),
        actorId: actor,
        action: 'timetable.import',
        entityType: 'timetable',
        entityId: 'timetable',
        metadata: Object.fromEntries(
          Object.entries(draft.outcome).map(([key, value]) => [key, String(value)]),
        ),
      })
      onChange?.()
      return draft.outcome
    },
  }
}
