/**
 * The teacher demo's platform: the demo teacher and her courses, built relative to "now" so the
 * review stages always look current. Its course IDs, codes and titles match the admin demo's
 * (MTH 202, SWE 311), so the apps describe one platform; the second MTH course, the archived
 * course and the other teacher's course exist only to show the "only your courses" rule.
 */

// The record shapes.
import type {
  ClassRecord,
  CourseRecord,
  PlatformData,
  SummaryRecord,
  UserRecord,
} from '@/services/platformData'

// The demo sign-in accounts, which are users of the platform too.
import { DEMO_ACCOUNTS } from '../mockAuthService'

/** Milliseconds in an hour and a day. */
const HOUR = 3_600_000
const DAY = 24 * HOUR

/** The signed-in demo teacher's ID. */
const TEACHER_ID = 'teacher-1'

/** Another teacher, whose course the demo teacher must never see. */
const OTHER_TEACHER_ID = 'teacher-smith'

/** The demo's users: the three sign-in accounts and the other teacher. */
function buildUsers(): UserRecord[] {
  return [
    ...DEMO_ACCOUNTS.map((account): UserRecord => ({
      id: account.id,
      role: account.role,
      status: 'active',
      fullName: account.fullName,
      email: account.email,
    })),
    {
      id: OTHER_TEACHER_ID,
      role: 'teacher',
      status: 'active',
      fullName: 'Dr. Smith',
      email: 'teacher-smith@conote.example',
    },
  ]
}

/** The courses: the demo teacher's three (one archived), and one belonging to another teacher. */
function buildCourses(now: Date): CourseRecord[] {
  return [
    {
      id: 'mth-202',
      code: 'MTH 202',
      title: 'Linear Algebra',
      status: 'ongoing',
      teacherId: TEACHER_ID,
      archivedAt: null,
    },
    {
      id: 'mth-301',
      code: 'MTH 301',
      title: 'Differential Equations',
      status: 'upcoming',
      teacherId: TEACHER_ID,
      archivedAt: null,
    },
    {
      id: 'mth-101',
      code: 'MTH 101',
      title: 'Calculus I',
      status: 'completed',
      teacherId: TEACHER_ID,
      archivedAt: new Date(now.getTime() - 30 * DAY).toISOString(),
    },
    {
      id: 'swe-311',
      code: 'SWE 311',
      title: 'Software Engineering',
      status: 'ongoing',
      teacherId: OTHER_TEACHER_ID,
      archivedAt: null,
    },
  ]
}

/**
 * One class per entry: its course, its number, how many days from now it starts (negative:
 * already held) and the stage of its summary (null: no summary yet, a class still to come).
 */
const CLASS_PLAN = [
  // MTH 202: three published, two waiting for the teacher (5 days and 1 day), one being drafted,
  // and one still to come.
  ['mth-202', 1, -35, 'published'],
  ['mth-202', 2, -28, 'published'],
  ['mth-202', 3, -21, 'published'],
  ['mth-202', 4, -5, 'in_review'],
  ['mth-202', 5, -1, 'in_review'],
  ['mth-202', 6, 0, 'processing'],
  ['mth-202', 7, 7, 'collecting'],
  // MTH 301 has not started.
  ['mth-301', 1, 30, 'collecting'],
  ['mth-301', 2, 37, 'collecting'],
  // SWE 311 belongs to another teacher; one of its summaries is waiting for her.
  ['swe-311', 1, -9, 'in_review'],
  ['swe-311', 2, -2, 'processing'],
  // The archived course.
  ['mth-101', 1, -120, 'published'],
] as const

/** The classes and summaries in `CLASS_PLAN`, dated from `now`. */
function buildClassesAndSummaries(now: Date, courses: CourseRecord[]) {
  const classes: ClassRecord[] = []
  const summaries: SummaryRecord[] = []
  for (const [courseId, number, offsetDays, stage] of CLASS_PLAN) {
    // The course, for its title and archive state.
    const course = courses.find((candidate) => candidate.id === courseId)
    // The class starts at 9:00 local time on its day.
    const start = new Date(now.getTime() + offsetDays * DAY)
    start.setHours(9, 0, 0, 0)
    const id = `${courseId}-${number}`
    classes.push({
      id,
      courseId,
      number,
      title: `${course?.title ?? courseId}, week ${number}`,
      startsAt: start.toISOString(),
      // A class in an archived course is archived with it.
      archivedAt: course?.archivedAt ?? null,
    })
    summaries.push({
      id: `summary-${id}`,
      classId: id,
      status: stage,
      // A summary entered review three hours after its class.
      inReviewSince:
        stage === 'in_review' ? new Date(start.getTime() + 3 * HOUR).toISOString() : null,
    })
  }
  return { classes, summaries }
}

/** The demo platform as it looks at `now`. */
export function createPlatformSeed(now: Date): PlatformData {
  // Courses first: classes read their titles and archive state.
  const courses = buildCourses(now)
  return { users: buildUsers(), courses, ...buildClassesAndSummaries(now, courses) }
}
