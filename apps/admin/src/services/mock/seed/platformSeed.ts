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
  AuditEntry,
  ClassRecord,
  CourseRecord,
  EnrollmentRecord,
  PlatformData,
  ResourceRecord,
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

/** Each teacher's department, by ID. */
const TEACHER_DEPARTMENTS: Record<string, string> = {
  'teacher-1': 'Mathematics',
  'teacher-smith': 'Software Engineering',
  'teacher-adeyemi': 'English',
  'teacher-bello': 'Computer Science',
  'teacher-okoro': 'Business Administration',
  'teacher-6': 'Physics',
}

/** The departments generated students belong to, in turn. */
const STUDENT_DEPARTMENTS = [
  'Software Engineering',
  'Computer Science',
  'Business Administration',
  'Mathematics',
]

/** Years of study, in turn. */
const LEVELS = ['100 Level', '200 Level', '300 Level', '400 Level']

/** Students 2 to 48 whose status isn't active: two invited, one suspended, one inactive. */
const SPECIAL_STATUS: Partial<Record<number, AccountStatus>> = {
  2: 'pending',
  3: 'pending',
  4: 'suspended',
  5: 'inactive',
}

/** A name for the n-th generated person, cycling through both lists. */
function personName(n: number) {
  return `${GIVEN[n % GIVEN.length]} ${FAMILY[(n * 7) % FAMILY.length]}`
}

/** A staff member's record: a sign-in teacher or administrator, or one of the generated teachers. */
function staffRecord(
  base: Pick<UserRecord, 'id' | 'role' | 'fullName' | 'email'>,
  n: number,
  clock: SeedClock,
): UserRecord {
  return {
    ...base,
    status: 'active',
    // Administrators have no staff number on the console; teachers do.
    staffNumber: base.role === 'teacher' ? `STF-${String(100 + n).padStart(4, '0')}` : null,
    studentNumber: null,
    department: TEACHER_DEPARTMENTS[base.id] ?? null,
    level: null,
    phone: `+234 803 555 ${String(1000 + n).slice(-4)}`,
    // Staff joined about a year ago.
    createdAt: clock.ago((380 - n) * DAY),
    // Active within the last day or two.
    lastActiveAt: clock.ago((n % 5) * 7 * HOUR + HOUR),
  }
}

/** Student `n` (1 is the sign-in account), with a status-appropriate history. */
function studentRecord(n: number, clock: SeedClock): UserRecord {
  // The sign-in student keeps their name and email.
  const account = DEMO_ACCOUNTS.find((candidate) => candidate.id === `student-${n}`)
  const status = SPECIAL_STATUS[n] ?? 'active'
  // Invited students were invited in the last few days; the rest joined at the start of the year.
  const createdAt = status === 'pending' ? clock.ago(n * DAY) : clock.ago((200 - n) * DAY)
  // When each kind of account was last used: never for invitations, weeks ago for blocked ones.
  const lastActive: Record<AccountStatus, string | null> = {
    pending: null,
    suspended: clock.ago(12 * DAY),
    inactive: clock.ago(40 * DAY),
    active: clock.ago((n % 9) * 5 * HOUR + 30 * 60_000),
  }
  return {
    id: `student-${n}`,
    role: 'student',
    status,
    fullName: account?.fullName ?? personName(n),
    email: account?.email ?? `student${n}@conote.example`,
    studentNumber: `U2023/${String(5000 + n)}`,
    staffNumber: null,
    // The sign-in student studies Software Engineering, like the student portal's demo student.
    department: n === 1 ? 'Software Engineering' : (STUDENT_DEPARTMENTS[n % 4] ?? null),
    level: n === 1 ? '300 Level' : (LEVELS[n % 4] ?? null),
    // Every third student left a phone number.
    phone: n % 3 === 0 ? `+234 802 555 ${String(2000 + n).slice(-4)}` : null,
    createdAt,
    lastActiveAt: lastActive[status],
  }
}

/** The demo's users: the three sign-in accounts, five more teachers and 47 more students. */
function buildUsers(clock: SeedClock): UserRecord[] {
  // The sign-in administrator and teacher.
  const users: UserRecord[] = DEMO_ACCOUNTS.filter((account) => account.role !== 'student').map(
    (account, index) => staffRecord(account, index, clock),
  )
  // The student portal's four teachers, then one more.
  STUDENT_PORTAL_TEACHERS.forEach(([id, fullName], index) => {
    users.push(
      staffRecord(
        { id, role: 'teacher', fullName, email: `${id}@conote.example` },
        index + 2,
        clock,
      ),
    )
  })
  users.push(
    staffRecord(
      {
        id: 'teacher-6',
        role: 'teacher',
        fullName: personName(26),
        email: 'teacher6@conote.example',
      },
      6,
      clock,
    ),
  )
  // Students 1 (the sign-in account) to 48.
  for (let n = 1; n <= 48; n += 1) users.push(studentRecord(n, clock))
  return users
}

/**
 * Who studies what: the sign-in student takes the student portal's four courses; every other
 * student who has signed up takes three of the courses in use.
 */
function buildEnrollments(users: UserRecord[], courses: CourseRecord[]): EnrollmentRecord[] {
  // The courses in use (not the archived one).
  const inUse = courses.slice(0, COURSES.length).map((course) => course.id)
  const enrollments: EnrollmentRecord[] = []
  users.forEach((user, index) => {
    // Students who have accepted their invitation.
    if (user.role !== 'student' || user.status === 'pending') return
    // The sign-in student: the student portal's courses.
    const courseIds =
      user.id === 'student-1'
        ? ['swe-311', 'eng-201', 'cse-205', 'bus-207']
        : [0, 2, 4].map((step) => inUse[(index + step) % inUse.length] ?? 'swe-311')
    for (const courseId of courseIds) enrollments.push({ courseId, studentId: user.id })
  })
  return enrollments
}

/** The audit history behind the users: each invitation, and the status changes since. */
function buildAuditLog(users: UserRecord[], clock: SeedClock): AuditEntry[] {
  // Every account was invited by the demo administrator when it was created.
  const log: AuditEntry[] = users.map((user) => ({
    id: `audit-invite-${user.id}`,
    at: user.createdAt,
    actorId: 'admin-1',
    action: 'user.invited',
    entityType: 'user',
    entityId: user.id,
    metadata: { role: user.role, status: 'pending' },
  }))
  // Each account that has signed in became active a day after its invitation.
  for (const user of users) {
    if (user.status === 'pending') continue
    log.push({
      id: `audit-activated-${user.id}`,
      at: new Date(Date.parse(user.createdAt) + DAY).toISOString(),
      actorId: user.id,
      action: 'user.status_changed',
      entityType: 'user',
      entityId: user.id,
      metadata: { from: 'pending', to: 'active' },
    })
  }
  // The suspended and the deactivated student.
  log.push(
    {
      id: 'audit-suspended-student-4',
      at: clock.ago(12 * DAY),
      actorId: 'admin-1',
      action: 'user.status_changed',
      entityType: 'user',
      entityId: 'student-4',
      metadata: { from: 'active', to: 'suspended' },
    },
    {
      id: 'audit-deactivated-student-5',
      at: clock.ago(40 * DAY),
      actorId: 'admin-1',
      action: 'user.status_changed',
      entityType: 'user',
      entityId: 'student-5',
      metadata: { from: 'active', to: 'inactive' },
    },
  )
  return log
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

/** Each course's department and one-line description, by code. */
const COURSE_DETAILS: Record<string, readonly [string, string]> = {
  'SWE 311': ['Software Engineering', 'Requirements, design, testing and the software life cycle.'],
  'ENG 201': ['English', 'Writing clear academic essays, with sources cited properly.'],
  'CSE 205': ['Computer Science', 'Balanced trees, hashing and graph algorithms.'],
  'BUS 207': ['Business Administration', 'From an idea to a business model, and testing it.'],
  'MTH 202': ['Mathematics', 'Vectors, matrices and linear transformations.'],
  'PHY 101': ['Physics', 'Motion, forces, energy and waves.'],
  'CSC 301': ['Computer Science', 'Processes, memory, file systems and concurrency.'],
  'GST 111': ['English', 'Spoken and written English for university study.'],
}

/** A course record for `code`, with its department and description. */
function courseFor(
  code: string,
  title: string,
  teacherId: string | null,
  extra: Pick<CourseRecord, 'status' | 'createdAt' | 'archivedAt'>,
): CourseRecord {
  // The department and description, if known.
  const [department, description] = COURSE_DETAILS[code] ?? [null, '']
  return {
    // The ID is the code in lower case, joined with a hyphen.
    id: code.toLowerCase().replace(' ', '-'),
    code,
    title,
    description,
    department,
    teacherId,
    ...extra,
  }
}

/** The courses in use, plus an archived course from last term. */
function buildCourses(clock: SeedClock): CourseRecord[] {
  // The courses in use, created before the term; the untaught one starts later.
  const courses = COURSES.map(([code, title, teacherId]) =>
    courseFor(code, title, teacherId, {
      status: teacherId ? 'ongoing' : 'upcoming',
      createdAt: clock.ago(70 * DAY),
      archivedAt: null,
    }),
  )
  // An archived course from last term, with one class someone forgot to archive.
  courses.push(
    courseFor('GST 111', 'Communication in English', 'teacher-adeyemi', {
      status: 'completed',
      createdAt: clock.ago(200 * DAY),
      archivedAt: clock.ago(10 * DAY),
    }),
  )
  return courses
}

/** Each course's outline and first slides, published; SWE 311 also has a draft. */
function buildResources(courses: CourseRecord[], clock: SeedClock): ResourceRecord[] {
  // Two per course.
  const resources: ResourceRecord[] = courses.flatMap((course) => [
    {
      id: `res-${course.id}-outline`,
      title: `${course.code} course outline`,
      type: 'pdf',
      courseId: course.id,
      classId: null,
      status: course.archivedAt ? 'archived' : 'published',
      createdAt: clock.ago(60 * DAY),
    },
    {
      id: `res-${course.id}-week-1`,
      title: `${course.title}: week 1 slides`,
      type: 'slides',
      courseId: course.id,
      classId: `${course.id}-1`,
      status: course.archivedAt ? 'archived' : 'published',
      createdAt: clock.ago(49 * DAY),
    },
  ])
  // A draft the teacher hasn't published yet.
  resources.push({
    id: 'res-swe-311-reading',
    title: 'Further reading on requirements',
    type: 'link',
    courseId: 'swe-311',
    classId: null,
    status: 'draft',
    createdAt: clock.ago(2 * DAY),
  })
  return resources
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

  const users = buildUsers(clock)
  return {
    users,
    enrollments: buildEnrollments(users, courses),
    auditLog: buildAuditLog(users, clock),
    courses,
    resources: buildResources(courses, clock),
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
