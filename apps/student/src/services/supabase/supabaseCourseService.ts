/**
 * The student's courses on Supabase (milestone B2). Row Level Security decides which courses a
 * student can read (only those they are in, and still in use); this service never filters by
 * "who is signed in" itself, so a mistake here cannot show someone else's courses.
 */

// The client type, and zod to check what comes back.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws.
import { AppError } from '@conote/core/errors'
// Refuses IDs that are not UUIDs before they reach a query.
import { isUuid } from '@conote/supabase/ids'

// Course and teacher shapes.
import type { Course, Teacher } from '@/types/domain'

// The interface this implementation must satisfy.
import type { CourseService } from '../types'

// Reads and checks rows.
import { readRows } from './rows'

// The columns of a course the pages show.
const COURSE_COLUMNS = 'id, code, title, description, status, schedule_text'

// SECURITY: each shape below is checked on arrival, so a status or field the app does not know
// is refused instead of reaching a screen.
const courseRow = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['upcoming', 'ongoing', 'completed']),
  schedule_text: z.string().nullable(),
})
// A teacher, by the course they teach.
const teacherRow = z.object({
  id: z.string(),
  full_name: z.string(),
  avatar_url: z.string().nullable(),
  course_id: z.string(),
})
// One class, only to count them.
const classRow = z.object({ course_id: z.string() })
// A course's number of students.
const countRow = z.object({ course_id: z.string(), student_count: z.number() })

// Shown when a course has no teacher (the teacher's account was removed, or none was set yet).
const NO_TEACHER: Teacher = { id: '', fullName: 'Not assigned yet' }

/** The error for a course that is missing or that the student may not read. */
function notFound() {
  // The same answer either way, so it does not reveal which courses exist.
  return new AppError('not_found', 'Course not found')
}

/** Builds the Supabase course service. */
export function createSupabaseCourseService({ client }: { client: SupabaseClient }): CourseService {
  /** Reads the readable courses (all, or just `id`) and joins teacher and counts onto each. */
  async function load(id?: string): Promise<Course[]> {
    // The courses themselves, in code order.
    let query = client.from('courses').select(COURSE_COLUMNS).order('code')
    // One course when asked for one.
    if (id !== undefined) query = query.eq('id', id)
    const courses = await readRows(query, courseRow)
    // Nothing to join onto.
    if (courses.length === 0) return []
    // The follow-up reads name only the courses found.
    const ids = courses.map((course) => course.id)
    // Teachers, classes and student counts are independent, so they are read together.
    const [teachers, classes, counts] = await Promise.all([
      readRows(
        client
          .from('course_teachers')
          .select('id, full_name, avatar_url, course_id')
          .in('course_id', ids),
        teacherRow,
      ),
      readRows(client.from('class_sessions').select('course_id').in('course_id', ids), classRow),
      readRows(
        client
          .from('course_student_counts')
          .select('course_id, student_count')
          .in('course_id', ids),
        countRow,
      ),
    ])
    // Lookups by course.
    const teacherByCourse = new Map(teachers.map((teacher) => [teacher.course_id, teacher]))
    const studentsByCourse = new Map(counts.map((count) => [count.course_id, count.student_count]))
    const classesByCourse = new Map<string, number>()
    for (const row of classes) {
      // Count one more class for this course.
      classesByCourse.set(row.course_id, (classesByCourse.get(row.course_id) ?? 0) + 1)
    }
    return courses.map((course): Course => {
      const teacher = teacherByCourse.get(course.id)
      const built: Course = {
        id: course.id,
        code: course.code,
        title: course.title,
        description: course.description,
        // A teacher's picture is included only when there is one.
        teacher: teacher
          ? {
              id: teacher.id,
              fullName: teacher.full_name,
              ...(teacher.avatar_url === null ? {} : { avatarUrl: teacher.avatar_url }),
            }
          : NO_TEACHER,
        studentCount: studentsByCourse.get(course.id) ?? 0,
        classCount: classesByCourse.get(course.id) ?? 0,
        status: course.status,
      }
      // The schedule is included only when there is one.
      return course.schedule_text === null
        ? built
        : { ...built, scheduleText: course.schedule_text }
    })
  }

  return {
    listMyCourses: () => load(),

    async getCourse(courseId) {
      // SECURITY: an ID that is not a UUID is turned away before it is used in a filter.
      if (!isUuid(courseId)) throw notFound()
      const [course] = await load(courseId)
      // Unknown, archived and not-mine courses all read as "not found".
      if (!course) throw notFound()
      return course
    },
  }
}
