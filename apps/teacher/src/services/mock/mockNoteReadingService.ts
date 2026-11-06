/**
 * The demo's note reading service (D123): the signed-in teacher reads the notes of the courses
 * they teach, with their authors, and who has and has not written for a class. It follows the
 * database's rules (see `search_notes` and `class_note_roster`), so the same screens work on both.
 */

// The shared error type.
import { AppError } from '@conote/core/errors'
// The shapes and the in-memory search.
import {
  searchNoteEntries,
  type NoteEntry,
  type NoteReadingService,
  type NoteRosterEntry,
} from '@conote/core/noteReading'

// The platform's records.
import type { PlatformData } from '../platformData'
// Pretends to take a moment, so loading states show.
import { simulateLatency } from './latency'

/** What the factory needs. */
interface MockNoteReadingOptions {
  data: PlatformData
  // The signed-in user's ID, or null when signed out.
  actorId: () => string | null
  // Delay per call; tests pass 0.
  latencyMs: number
}

/** Builds the demo note reading service over `data`. */
export function createMockNoteReadingService({
  data,
  actorId,
  latencyMs,
}: Readonly<MockNoteReadingOptions>): NoteReadingService {
  /** The IDs of the courses the signed-in teacher teaches (archived ones left out). */
  function taughtCourseIds(): Set<string> {
    const teacherId = actorId()
    // SECURITY: no session, no notes.
    if (teacherId === null) throw new AppError('unauthorized', 'Sign in to read notes.')
    return new Set(
      data.courses
        .filter((course) => course.teacherId === teacherId && course.archivedAt === null)
        .map((course) => course.id),
    )
  }

  /** Every note of the taught courses, with its author, class and course. */
  function entriesOf(courseIds: ReadonlySet<string>): NoteEntry[] {
    return data.notes.flatMap((note): NoteEntry[] => {
      const cls = data.classes.find((candidate) => candidate.id === note.classId)
      const course = data.courses.find((candidate) => candidate.id === cls?.courseId)
      const student = data.users.find((candidate) => candidate.id === note.studentId)
      // SECURITY: a note of a course the teacher does not teach is never read.
      if (!cls || !course || !student || !courseIds.has(course.id)) return []
      return [
        {
          id: note.id,
          classId: cls.id,
          classNumber: cls.number,
          classTitle: cls.title,
          courseId: course.id,
          courseCode: course.code,
          courseTitle: course.title,
          studentId: student.id,
          studentName: student.fullName,
          studentNumber: null,
          title: note.title,
          contentHtml: note.contentHtml,
          createdAt: note.createdAt,
          updatedAt: note.createdAt,
        },
      ]
    })
  }

  return {
    async searchNotes(query) {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      return searchNoteEntries(entriesOf(taughtCourseIds()), query)
    },

    async getNoteRoster(classId) {
      await simulateLatency(latencyMs)
      const courseIds = taughtCourseIds()
      const cls = data.classes.find((candidate) => candidate.id === classId)
      if (!cls) throw new AppError('not_found', 'We could not find that.')
      // SECURITY: another teacher's class is refused, and its roster is never built.
      if (!courseIds.has(cls.courseId)) {
        throw new AppError('forbidden', 'You do not have access to this.')
      }
      // Everyone enrolled, and anyone who wrote a note and has left.
      const ids = new Set([
        ...data.enrollments
          .filter((enrolment) => enrolment.courseId === cls.courseId)
          .map((enrolment) => enrolment.studentId),
        ...data.notes.filter((note) => note.classId === classId).map((note) => note.studentId),
      ])
      return [...ids]
        .flatMap((studentId): NoteRosterEntry[] => {
          const student = data.users.find((candidate) => candidate.id === studentId)
          if (!student) return []
          return [
            {
              studentId,
              studentName: student.fullName,
              studentNumber: null,
              noteCount: data.notes.filter(
                (note) => note.classId === classId && note.studentId === studentId,
              ).length,
            },
          ]
        })
        .sort((a, b) => a.studentName.localeCompare(b.studentName))
    },
  }
}
