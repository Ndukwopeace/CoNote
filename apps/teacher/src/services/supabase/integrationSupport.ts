/**
 * What the teacher real-backend tests share: reading their settings and loading a contract's small
 * platform into a local Supabase stack. The ID translation, the signed-in clients and the
 * local-only check are shared with the other apps (`@conote/testing/integrationSupport`). Used only
 * by tests that run against the throwaway local stack (the last step of the "Supabase contract
 * tests" job); never import it from app code.
 *
 * SECURITY: loading a platform first EMPTIES the stack's accounts and courses, so the harness
 * refuses to run against anything but a local address.
 */

// The shared harness: settings, ID translation and signed-in clients.
import {
  StackHarness,
  ok,
  readStackSettings,
  type HarnessOptions,
} from '@conote/testing/integrationSupport'

// The records a contract builds, and the builders for the stand-ins it may need.
import { courseRecord, userRecord, type PlatformData } from '../platformData'

// The stack to test against, from the environment.
const SETTINGS = readStackSettings(import.meta.env)

/** True when every setting the suites need is present; otherwise they are skipped. */
export const CONFIGURED = SETTINGS.configured

/** The student whose notes fill the counts a contract asks for. */
const STAND_IN_STUDENT = 'harness-student'

/**
 * `data` plus stand-ins for what its records point at but do not describe: the teachers courses
 * name, the courses classes belong to, and a student to have written the notes the records count.
 * Stand-in courses are archived and have no teacher, so a teacher sees none of them.
 */
function withStubs(data: PlatformData): PlatformData {
  const knownUsers = new Set(data.users.map((user) => user.id))
  const knownCourses = new Set(data.courses.map((course) => course.id))
  const wantedTeachers = new Set(
    data.courses.flatMap((course) => (course.teacherId === null ? [] : [course.teacherId])),
  )
  const wantedReviewers = new Set(
    data.summaries.flatMap((summary) => (summary.reviewedBy === null ? [] : [summary.reviewedBy])),
  )
  const wantedCourses = new Set(data.classes.map((item) => item.courseId))
  const missingTeachers = [...wantedTeachers].filter((id) => !knownUsers.has(id))
  const missingReviewers = [...wantedReviewers].filter(
    (id) => !knownUsers.has(id) && !wantedTeachers.has(id),
  )
  const missingCourses = [...wantedCourses].filter((id) => !knownCourses.has(id))
  const needsStudent =
    data.classes.some((item) => item.noteCount > 0) &&
    !data.users.some((user) => user.role === 'student')
  return {
    ...data,
    users: [
      ...data.users,
      ...missingTeachers.map((id) => userRecord({ id, role: 'teacher' })),
      ...missingReviewers.map((id) => userRecord({ id, role: 'teacher' })),
      ...(needsStudent ? [userRecord({ id: STAND_IN_STUDENT, role: 'student' })] : []),
    ],
    courses: [
      ...data.courses,
      ...missingCourses.map((id) =>
        courseRecord({ id, archivedAt: '2000-01-02T00:00:00.000Z', status: 'completed' }),
      ),
    ],
  }
}

/** Loads the teacher contracts' platforms into the stack and builds clients for them. */
export class Harness extends StackHarness<PlatformData> {
  constructor(options: HarnessOptions = {}) {
    super(SETTINGS, options)
  }

  /** Makes the stack hold exactly `source`'s accounts, courses and what hangs off them. */
  protected async load(source: PlatformData) {
    const data = withStubs(source)
    await this.wipe()
    await this.ensureUsers(data.users)
    const id = (short: string) => this.ids.uuid(short)
    // The accounts as the contract describes them. A course can only be given an active teacher,
    // so a teacher who is inactive in the records is made active here and switched off again once
    // the courses are in.
    ok(
      await this.server.from('profiles').upsert(
        data.users.map((user) => ({
          id: id(user.id),
          email: user.email,
          role: user.role,
          status: user.role === 'teacher' ? 'active' : user.status,
          full_name: user.fullName,
        })),
      ),
      'profiles',
    )
    // Start the courses from nothing, then add the contract's. (The shared wipe runs once; the
    // courses of the previous test must go before each load.)
    ok(
      await this.server.from('courses').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      'courses',
    )
    if (data.courses.length > 0) {
      ok(
        await this.server.from('courses').insert(
          data.courses.map((course) => ({
            id: id(course.id),
            code: course.code,
            title: course.title,
            status: course.status,
            teacher_id: course.teacherId === null ? null : id(course.teacherId),
            archived_at: course.archivedAt,
          })),
        ),
        'insert courses',
      )
    }
    for (const user of data.users) {
      if (user.role === 'teacher' && user.status !== 'active') {
        ok(
          await this.server.from('profiles').update({ status: user.status }).eq('id', id(user.id)),
          'teacher status',
        )
      }
    }
    if (data.classes.length > 0) {
      ok(
        await this.server.from('class_sessions').insert(
          data.classes.map((item) => ({
            id: id(item.id),
            course_id: id(item.courseId),
            number: item.number,
            title: item.title,
            starts_at: item.startsAt,
            // The records carry no end time; the database refuses a class that ends before it
            // starts, so each class gets an hour.
            ends_at: new Date(Date.parse(item.startsAt) + 3_600_000).toISOString(),
            archived_at: item.archivedAt,
          })),
        ),
        'insert classes',
      )
      // Notes are private, and the portal only counts them: the record's count becomes that many
      // notes, written by the students in turn.
      const students = data.users.filter((user) => user.role === 'student')
      const notes = data.classes.flatMap((item) =>
        Array.from({ length: item.noteCount }, (_unused, index) => ({
          student_id: id(students[index % Math.max(students.length, 1)]?.id ?? ''),
          course_id: id(item.courseId),
          class_id: id(item.id),
          title: `Note ${String(index + 1)}`,
        })),
      )
      if (notes.length > 0) ok(await this.server.from('notes').insert(notes), 'insert notes')
    }
    if (data.summaries.length > 0) {
      const courseOf = new Map(data.classes.map((item) => [item.id, item.courseId]))
      ok(
        await this.server.from('summaries').insert(
          data.summaries.map((summary) => ({
            id: id(summary.id),
            class_id: id(summary.classId),
            course_id: id(courseOf.get(summary.classId) ?? ''),
            status: summary.status,
            overview: summary.draft.overview,
            key_concepts: summary.draft.keyConcepts,
            confusion_areas: summary.draft.confusionAreas,
            key_topics: summary.draft.keyTopics,
            version: summary.version,
            notes_analyzed_count: summary.notesAnalyzedCount,
            students_analyzed_count: summary.studentCount,
            in_review_since: summary.inReviewSince,
            reviewed_by: summary.reviewedBy === null ? null : id(summary.reviewedBy),
            published_at: summary.publishedAt,
          })),
        ),
        'insert summaries',
      )
    }
  }
}
