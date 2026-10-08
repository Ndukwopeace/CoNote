/**
 * The demo platform (D69): users, courses, classes, summaries, AI jobs, measured activity and a
 * few problems, built relative to "now" so the dashboard always shows a live-looking platform.
 * Numbers come from a fixed pseudo-random sequence, so the same clock gives the same data.
 */

// The shared vocabulary.
import type { AccountStatus } from '@conote/domain'

// The local day key, for the term dates.
import { localDateKey } from '@/lib/activity'
// The record shapes.
import type {
  ActivityEvent,
  ActivityEventKind,
  AiJobRecord,
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

/** How many days of activity the demo keeps: the chart's longest range. */
const ACTIVITY_DAYS = 90

/** How many weekly classes each course has in the term. */
const WEEKS = 15

/** A small, fixed pseudo-random sequence (mulberry32), so the demo is repeatable. */
function sequence(seed: number) {
  // The generator's state.
  let state = seed
  // The next number in [0, 1).
  return () => {
    // Kept as an unsigned 32-bit number, so it wraps instead of growing.
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** Given names and family names the demo users are built from. */
const GIVEN = [
  'Ada',
  'Chidi',
  'Ngozi',
  'Tunde',
  'Amina',
  'Emeka',
  'Zainab',
  'Ifeoma',
  'Bola',
  'Kelechi',
  'Funmi',
  'Musa',
]
const FAMILY = [
  'Okafor',
  'Adeyemi',
  'Bello',
  'Okoro',
  'Nwosu',
  'Ibrahim',
  'Eze',
  'Balogun',
  'Obi',
  'Lawal',
]

/**
 * The courses: code, title and teacher (null: none assigned yet). The first four are the student
 * portal's demo courses, with the same IDs, titles and teachers, so both apps describe one platform.
 */
const COURSES: readonly (readonly [string, string, string | null])[] = [
  ['SWE 311', 'Software Engineering', 'teacher-smith'],
  ['ENG 201', 'Academic Writing', 'teacher-adeyemi'],
  ['CSE 205', 'Data Structures & Algorithms II', 'teacher-bello'],
  ['BUS 207', 'Entrepreneurship & Innovation', 'teacher-okoro'],
  ['MTH 202', 'Linear Algebra', 'teacher-1'],
  ['PHY 101', 'General Physics', 'teacher-6'],
  ['CSC 301', 'Operating Systems', null],
]

/** The student portal's demo teachers (apps/student/src/services/mock/seed), by ID and name. */
const STUDENT_PORTAL_TEACHERS = [
  ['teacher-smith', 'Dr. Smith'],
  ['teacher-adeyemi', 'Mrs. Adeyemi'],
  ['teacher-bello', 'Dr. Bello'],
  ['teacher-okoro', 'Mr. Okoro'],
] as const

/** The demo's users: the three sign-in accounts, five more teachers and 47 more students. */
function buildUsers(): UserRecord[] {
  // The sign-in accounts, active.
  const users: UserRecord[] = DEMO_ACCOUNTS.map((account) => ({
    ...account,
    status: 'active',
  }))
  // A name for the n-th generated person, cycling through both lists.
  const name = (n: number) => `${GIVEN[n % GIVEN.length]} ${FAMILY[(n * 7) % FAMILY.length]}`
  // The student portal's four teachers, then one more.
  for (const [id, fullName] of STUDENT_PORTAL_TEACHERS) {
    users.push({ id, role: 'teacher', status: 'active', fullName, email: `${id}@conote.example` })
  }
  users.push({
    id: 'teacher-6',
    role: 'teacher',
    status: 'active',
    fullName: name(26),
    email: 'teacher6@conote.example',
  })
  // Students 2 to 48: two invited, one suspended, one inactive, the rest active.
  const special: Partial<Record<number, AccountStatus>> = {
    2: 'pending',
    3: 'pending',
    4: 'suspended',
    5: 'inactive',
  }
  for (let n = 2; n <= 48; n += 1) {
    const status = special[n] ?? 'active'
    users.push({
      id: `student-${n}`,
      role: 'student',
      status,
      fullName: name(n),
      email: `student${n}@conote.example`,
    })
  }
  return users
}

/** The clock the seed is built around. */
interface SeedClock {
  // Now, in milliseconds.
  nowMs: number
  // Local midnight today.
  today: Date
  // `ms` before now, as ISO text.
  ago: (ms: number) => string
}

/** The courses in use, plus an archived course from last term. */
function buildCourses(clock: SeedClock): CourseRecord[] {
  // The courses in use; the ID is the code in lower case, joined with a hyphen.
  const courses: CourseRecord[] = COURSES.map(([code, title, teacherId]) => ({
    id: code.toLowerCase().replace(' ', '-'),
    code,
    title,
    teacherId,
    archivedAt: null,
  }))
  // An archived course from last term, with one class someone forgot to archive.
  courses.push({
    id: 'gst-111',
    code: 'GST 111',
    title: 'Communication in English',
    teacherId: 'teacher-adeyemi',
    archivedAt: clock.ago(10 * DAY),
  })
  return courses
}

/** Weekly classes for each course in use, and the archived course's three. */
function buildClasses(courses: CourseRecord[], termStart: Date, clock: SeedClock): ClassRecord[] {
  const classes: ClassRecord[] = []
  // Each course in use on its own weekday and hour.
  courses.slice(0, COURSES.length).forEach((course, index) => {
    for (let week = 0; week < WEEKS; week += 1) {
      classes.push({
        id: `${course.id}-${week + 1}`,
        courseId: course.id,
        title: `${course.title}, week ${week + 1}`,
        startsAt: new Date(
          termStart.getFullYear(),
          termStart.getMonth(),
          termStart.getDate() + week * 7 + index,
          9 + index,
        ).toISOString(),
        archivedAt: null,
      })
    }
  })
  // The archived course's classes: archived, apart from the forgotten one.
  for (let n = 1; n <= 3; n += 1) {
    classes.push({
      id: `gst-111-${n}`,
      courseId: 'gst-111',
      title: `Communication in English, week ${n}`,
      startsAt: clock.ago((120 - n * 7) * DAY),
      archivedAt: n === 3 ? null : clock.ago(10 * DAY),
    })
  }
  return classes
}

/** Summaries and AI jobs for the classes that have started, plus jobs in progress and failed. */
function buildSummariesAndJobs(classes: ClassRecord[], clock: SeedClock, random: () => number) {
  const summaries: SummaryRecord[] = []
  const aiJobs: AiJobRecord[] = []
  for (const cls of classes) {
    // Days since the class started; nothing for classes still to come or the archived course.
    const startMs = Date.parse(cls.startsAt)
    const age = (clock.nowMs - startMs) / DAY
    if (age < 1 || cls.courseId === 'gst-111') continue
    // The summary was generated three hours after the class.
    const generatedAt = new Date(startMs + 3 * HOUR).toISOString()
    aiJobs.push({
      id: `job-${cls.id}`,
      classId: cls.id,
      status: 'succeeded',
      finishedAt: generatedAt,
    })
    // SWE 311's class from four to ten days ago is still waiting for its teacher (an alert);
    // other classes from the last four days are in review; older ones are published.
    const waiting = age < 4 || (cls.courseId === 'swe-311' && age < 11)
    // Published two days after the class, between 1 and 8 hours into that day.
    const publishedAt = new Date(startMs + 2 * DAY + (1 + Math.floor(random() * 8)) * HOUR)
    summaries.push({
      id: `summary-${cls.id}`,
      classId: cls.id,
      status: waiting ? 'in_review' : 'published',
      inReviewSince: waiting ? generatedAt : null,
      publishedAt: waiting ? null : publishedAt.toISOString(),
    })
  }
  // Two jobs in progress, and failures three hours and thirty hours ago (only one is recent).
  aiJobs.push(
    { id: 'job-running', classId: 'cse-205-8', status: 'running', finishedAt: null },
    { id: 'job-queued', classId: 'bus-207-8', status: 'queued', finishedAt: null },
    {
      id: 'job-failed-recent',
      classId: 'mth-202-7',
      status: 'failed',
      finishedAt: clock.ago(3 * HOUR),
    },
    {
      id: 'job-failed-older',
      classId: 'phy-101-6',
      status: 'failed',
      finishedAt: clock.ago(30 * HOUR),
    },
  )
  return { summaries, aiJobs }
}

/** A typical weekday's count for each kind of measured activity. */
const TYPICAL_ACTIVITY: Record<ActivityEventKind, number> = {
  sign_in: 60,
  note_created: 30,
  summary_viewed: 20,
  resource_opened: 25,
  ai_question: 15,
}

/** Measured activity for each of the last 90 days: busier on weekdays. */
function buildActivity(clock: SeedClock, random: () => number): ActivityEvent[] {
  const activity: ActivityEvent[] = []
  const { today, nowMs } = clock
  for (let offset = ACTIVITY_DAYS - 1; offset >= 0; offset -= 1) {
    // Midnight of that day, and how much of it has happened (all of it, except today).
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    const span = offset === 0 ? Math.max(nowMs - dayStart.getTime(), 1) : DAY
    // Weekends are quieter.
    const weekday = dayStart.getDay() % 6 !== 0
    for (const [kind, base] of Object.entries(TYPICAL_ACTIVITY) as [ActivityEventKind, number][]) {
      // About the typical count on a weekday, a quarter of it at weekends, scaled to the part of
      // the day that has passed. A whole day always has at least one.
      const expected = (weekday ? base : base / 4) * (0.7 + random() * 0.6) * (span / DAY)
      const count = offset === 0 ? Math.round(expected) : Math.max(1, Math.round(expected))
      // Each event at a random moment of the part of the day that has passed.
      for (let n = 0; n < count; n += 1) {
        activity.push({ kind, at: new Date(dayStart.getTime() + random() * span).toISOString() })
      }
    }
  }
  return activity
}

/** Builds the demo platform for the clock `now`. */
export function createPlatformSeed(now: Date): PlatformData {
  // The same numbers every time.
  const random = sequence(20_261_008)
  // Times relative to now, and local midnight today, the anchor for class times.
  const nowMs = now.getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const clock: SeedClock = { nowMs, today, ago: (ms) => new Date(nowMs - ms).toISOString() }
  // The term: seven weeks ago to eight weeks ahead, so today is always inside it.
  const termStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 49)
  const termEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 56)

  // The records, built in a fixed order so the random numbers fall the same way each time.
  const courses = buildCourses(clock)
  const classes = buildClasses(courses, termStart, clock)
  const { summaries, aiJobs } = buildSummariesAndJobs(classes, clock, random)
  const activity = buildActivity(clock, random)

  return {
    users: buildUsers(),
    courses,
    classes,
    summaries,
    aiJobs,
    activity,
    // Two notifications that bounced today.
    deliveryFailures: [
      { id: 'delivery-1', at: clock.ago(2 * HOUR) },
      { id: 'delivery-2', at: clock.ago(5 * HOUR) },
    ],
    // Storage has been fine.
    storageErrors: [],
    // Repeated failed sign-ins on one account an hour ago.
    securityEvents: [
      { id: 'security-1', action: 'auth.repeated_failed_sign_in', at: clock.ago(HOUR) },
    ],
    settings: {
      termStartsOn: localDateKey(termStart),
      termEndsOn: localDateKey(termEnd),
      reviewAlertDays: 3,
    },
  }
}
