/**
 * The demo data (REQUIREMENTS.md section 13), built relative to "now" so the demo always has a
 * live class, classes later today, upcoming classes and past ones, whenever it is opened.
 */

// The shapes the demo serves.
import type { AppNotification, ClassSession, Course, Note, Summary, Teacher } from '@/types/domain'

// The demo student every note belongs to (the same ID the demo sign-in uses).
import { DEMO_STUDENT_ID } from './constants'

/** The four preset note tags (FR-NTE-3). */
export const PRESET_TAGS = ['Key concept', 'Question', 'Example', 'Aha moment'] as const

/** Everything the demo services serve. */
export interface Seed {
  // Enrolled courses, in display order.
  courses: Course[]
  // Every class of those courses.
  classes: ClassSession[]
  // The demo student's notes.
  notes: Note[]
  // Summaries of published classes only.
  summaries: Summary[]
  // The demo student's notifications.
  notifications: AppNotification[]
}

/** Milliseconds in a minute and a day. */
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** The local date `dayOffset` days from `now`, at `hour`:`minute`, as ISO text. */
function dayAt(now: Date, dayOffset: number, hour: number, minute = 0): string {
  // Build from the local calendar date, so "9 AM" is 9 AM on the student's clock.
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    hour,
    minute,
  ).toISOString()
}

/** `minutes` before `now`, as ISO text. */
function minutesAgo(now: Date, minutes: number): string {
  // Straight subtraction; used for notes and notifications.
  return new Date(now.getTime() - minutes * MINUTE).toISOString()
}

/** The four teachers. */
const TEACHERS = {
  // SWE 311.
  smith: { id: 'teacher-smith', fullName: 'Dr. Smith' },
  // ENG 201.
  adeyemi: { id: 'teacher-adeyemi', fullName: 'Mrs. Adeyemi' },
  // CSE 205.
  bello: { id: 'teacher-bello', fullName: 'Dr. Bello' },
  // BUS 207.
  okoro: { id: 'teacher-okoro', fullName: 'Mr. Okoro' },
  // satisfies checks every entry is a Teacher while keeping the exact keys, so lookups are typed.
} satisfies Record<string, Teacher>

/** A class session with times worked out from `now`. */
interface ClassPlan {
  // Class ID.
  id: string
  // Course ID.
  courseId: string
  // Position in the course.
  number: number
  // Lesson title.
  title: string
  // One-line description.
  description: string
  // Start and end as ISO text.
  startsAt: string
  endsAt: string
  // Summary stage.
  summaryStatus: ClassSession['summaryStatus']
}

/** Builds the classes: one live now, one later today, and a spread of past and future ones. */
function buildClasses(now: Date): ClassPlan[] {
  // The half hour now falls in, e.g. 10:07 → 10:00.
  const halfHour = new Date(now)
  halfHour.setMinutes(now.getMinutes() < 30 ? 0 : 30, 0, 0)
  // A live class: started 30–60 minutes ago, ends in 60–90 minutes. Always live, at any time.
  const liveStart = new Date(halfHour.getTime() - 30 * MINUTE)
  const liveEnd = new Date(liveStart.getTime() + 2 * 60 * MINUTE)
  // A class three hours after the live one (later today, or early tomorrow near midnight).
  const laterStart = new Date(halfHour.getTime() + 3 * 60 * MINUTE)
  const laterEnd = new Date(laterStart.getTime() + 2 * 60 * MINUTE)

  return [
    // SWE 311: the four classes from the wireframes.
    {
      id: 'swe-311-c1',
      courseId: 'swe-311',
      number: 1,
      title: 'Introduction to Software Engineering',
      description: 'What software engineering is, and why teams need a process.',
      startsAt: dayAt(now, -21, 9),
      endsAt: dayAt(now, -21, 11),
      summaryStatus: 'published',
    },
    {
      id: 'swe-311-c2',
      courseId: 'swe-311',
      number: 2,
      title: 'Software Requirements',
      description: 'Functional and non-functional requirements, and how to write them down.',
      startsAt: dayAt(now, -14, 9),
      endsAt: dayAt(now, -14, 11),
      summaryStatus: 'published',
    },
    {
      id: 'swe-311-c3',
      courseId: 'swe-311',
      number: 3,
      title: 'Requirement Validation',
      description: 'Reviews, prototypes and test cases that check requirements are right.',
      startsAt: dayAt(now, -7, 9),
      endsAt: dayAt(now, -7, 11),
      summaryStatus: 'in_review',
    },
    {
      id: 'swe-311-c4',
      courseId: 'swe-311',
      number: 4,
      title: 'SDLC Models',
      description: 'Waterfall, iterative and agile life cycles compared.',
      startsAt: liveStart.toISOString(),
      endsAt: liveEnd.toISOString(),
      summaryStatus: 'collecting',
    },
    // ENG 201.
    {
      id: 'eng-201-c1',
      courseId: 'eng-201',
      number: 1,
      title: 'Essay Structure',
      description: 'Introductions, body paragraphs and conclusions that connect.',
      startsAt: dayAt(now, -5, 14),
      endsAt: dayAt(now, -5, 16),
      summaryStatus: 'published',
    },
    {
      id: 'eng-201-c2',
      courseId: 'eng-201',
      number: 2,
      title: 'Citing Sources',
      description: 'When and how to cite, and avoiding plagiarism.',
      startsAt: dayAt(now, 1, 14),
      endsAt: dayAt(now, 1, 16),
      summaryStatus: 'collecting',
    },
    {
      id: 'eng-201-c3',
      courseId: 'eng-201',
      number: 3,
      title: 'Argument and Evidence',
      description: 'Building a claim and supporting it with evidence.',
      startsAt: dayAt(now, 8, 14),
      endsAt: dayAt(now, 8, 16),
      summaryStatus: 'collecting',
    },
    // CSE 205.
    {
      id: 'cse-205-c1',
      courseId: 'cse-205',
      number: 1,
      title: 'Balanced Search Trees',
      description: 'AVL and red-black trees, and why balance matters.',
      startsAt: dayAt(now, -3, 10),
      endsAt: dayAt(now, -3, 12),
      summaryStatus: 'processing',
    },
    {
      id: 'cse-205-c2',
      courseId: 'cse-205',
      number: 2,
      title: 'Hash Tables',
      description: 'Hash functions, collisions and load factors.',
      startsAt: laterStart.toISOString(),
      endsAt: laterEnd.toISOString(),
      summaryStatus: 'collecting',
    },
    {
      id: 'cse-205-c3',
      courseId: 'cse-205',
      number: 3,
      title: 'Graph Traversal',
      description: 'Breadth-first and depth-first search, and where each fits.',
      startsAt: dayAt(now, 6, 10),
      endsAt: dayAt(now, 6, 12),
      summaryStatus: 'collecting',
    },
    // BUS 207: starts in two weeks.
    {
      id: 'bus-207-c1',
      courseId: 'bus-207',
      number: 1,
      title: 'What Makes a Startup',
      description: 'Problems worth solving and the people who solve them.',
      startsAt: dayAt(now, 14, 13),
      endsAt: dayAt(now, 14, 15),
      summaryStatus: 'collecting',
    },
    {
      id: 'bus-207-c2',
      courseId: 'bus-207',
      number: 2,
      title: 'The Business Model Canvas',
      description: 'Mapping how a venture creates and captures value.',
      startsAt: dayAt(now, 21, 13),
      endsAt: dayAt(now, 21, 15),
      summaryStatus: 'collecting',
    },
  ]
}

/** The four courses from the wireframes; class counts are filled in from the classes. */
function buildCourses(classes: readonly ClassPlan[]): Course[] {
  /** How many classes a course has. */
  const count = (courseId: string) => classes.filter((c) => c.courseId === courseId).length
  return [
    {
      id: 'swe-311',
      code: 'SWE 311',
      title: 'Software Engineering',
      description:
        'How teams plan, build, test and maintain software: requirements, design, process models and quality.',
      teacher: TEACHERS.smith,
      studentCount: 48,
      classCount: count('swe-311'),
      status: 'ongoing',
      scheduleText: 'Mondays and Wednesdays, 9–11 AM',
    },
    {
      id: 'eng-201',
      code: 'ENG 201',
      title: 'Academic Writing',
      description: 'Clear, well-argued academic writing: structure, sources and style.',
      teacher: TEACHERS.adeyemi,
      studentCount: 60,
      classCount: count('eng-201'),
      status: 'ongoing',
      scheduleText: 'Tuesdays, 2–4 PM',
    },
    {
      id: 'cse-205',
      code: 'CSE 205',
      title: 'Data Structures & Algorithms II',
      description: 'Trees, hashing and graphs, with the analysis to choose between them.',
      teacher: TEACHERS.bello,
      studentCount: 52,
      classCount: count('cse-205'),
      status: 'ongoing',
      scheduleText: 'Thursdays, 10 AM–12 PM',
    },
    {
      id: 'bus-207',
      code: 'BUS 207',
      title: 'Entrepreneurship & Innovation',
      description: 'Turning ideas into ventures: opportunity, business models and pitching.',
      teacher: TEACHERS.okoro,
      studentCount: 35,
      classCount: count('bus-207'),
      status: 'upcoming',
      scheduleText: 'Fridays, 1–3 PM',
    },
  ]
}

/** The demo student's notes: 11 across four courses' classes, using every preset tag. */
function buildNotes(now: Date): Note[] {
  /** One note; created and last edited `minutes` ago. */
  const note = (
    id: string,
    courseId: string,
    classId: string,
    title: string,
    body: string,
    tags: string[],
    minutes: number,
  ): Note => ({
    id,
    studentId: DEMO_STUDENT_ID,
    courseId,
    classId,
    title,
    // Plain paragraphs; rendered only through SafeHtml.
    contentHtml: `<p>${body}</p>`,
    tags,
    createdAt: minutesAgo(now, minutes),
    updatedAt: minutesAgo(now, minutes),
  })
  return [
    note(
      'note-1',
      'swe-311',
      'swe-311-c1',
      'Why process matters',
      'Without an agreed process, teams duplicate work and miss requirements.',
      ['Key concept'],
      21 * 24 * 60,
    ),
    note(
      'note-2',
      'swe-311',
      'swe-311-c1',
      'Software crisis',
      'The 1968 NATO conference named the "software crisis": projects late and over budget.',
      ['Example'],
      21 * 24 * 60 - 30,
    ),
    note(
      'note-3',
      'swe-311',
      'swe-311-c2',
      'Functional vs non-functional',
      'Functional: what the system does. Non-functional: how well it does it (speed, security, usability).',
      ['Key concept'],
      14 * 24 * 60,
    ),
    note(
      'note-4',
      'swe-311',
      'swe-311-c2',
      'Is "fast" a requirement?',
      'Only if it is measurable, e.g. "search returns in under 2 seconds".',
      ['Question', 'Aha moment'],
      14 * 24 * 60 - 45,
    ),
    note(
      'note-5',
      'swe-311',
      'swe-311-c3',
      'Validation vs verification',
      'Validation: are we building the right thing? Verification: are we building it right?',
      ['Aha moment'],
      7 * 24 * 60,
    ),
    note(
      'note-6',
      'swe-311',
      'swe-311-c3',
      'Prototype reviews',
      'Showing users a prototype early catches misunderstood requirements.',
      ['Example'],
      7 * 24 * 60 - 20,
    ),
    note(
      'note-7',
      'swe-311',
      'swe-311-c4',
      'Waterfall in one line',
      'Each phase finishes before the next starts; changes late are expensive.',
      ['Key concept'],
      25,
    ),
    note(
      'note-8',
      'eng-201',
      'eng-201-c1',
      'Thesis first',
      'Every paragraph should support the thesis in the introduction.',
      ['Key concept'],
      5 * 24 * 60,
    ),
    note(
      'note-9',
      'eng-201',
      'eng-201-c1',
      'Topic sentences',
      'Can a topic sentence be a question? Ask Mrs. Adeyemi.',
      ['Question'],
      5 * 24 * 60 - 60,
    ),
    note(
      'note-10',
      'cse-205',
      'cse-205-c1',
      'AVL rotations',
      'A left-right case needs two rotations: left on the child, then right on the node.',
      ['Example', 'Key concept'],
      3 * 24 * 60,
    ),
    note(
      'note-11',
      'cse-205',
      'cse-205-c1',
      'Why balance?',
      'An unbalanced tree can degrade to a linked list, making search O(n).',
      ['Aha moment'],
      3 * 24 * 60 - 15,
    ),
  ]
}

/** Summaries for the three published classes (and only those). */
function buildSummaries(now: Date): Summary[] {
  return [
    {
      id: 'summary-swe-311-c1',
      classId: 'swe-311-c1',
      courseId: 'swe-311',
      overview:
        'Software engineering applies a disciplined process to building software, so teams can deliver reliable systems on time.',
      keyConcepts: [
        {
          id: 'k1',
          title: 'Software process',
          explanation:
            'An agreed sequence of activities that turns requirements into working software.',
        },
        {
          id: 'k2',
          title: 'The software crisis',
          explanation:
            'The recognition, in the 1960s, that ad-hoc development led to late and faulty systems.',
        },
      ],
      confusionAreas: [
        {
          id: 'c1',
          issue: 'Is software engineering just programming?',
          clarification:
            'Programming is one activity; engineering also covers requirements, design, testing and maintenance.',
        },
      ],
      keyTopics: [
        { id: 't1', name: 'Process' },
        { id: 't2', name: 'Quality' },
      ],
      notesAnalyzedCount: 36,
      reviewedBy: TEACHERS.smith,
      publishedAt: dayAt(now, -19, 16),
      viewedByMe: true,
    },
    {
      id: 'summary-swe-311-c2',
      classId: 'swe-311-c2',
      courseId: 'swe-311',
      overview:
        'Requirements describe what a system must do (functional) and the qualities it must have (non-functional). Good requirements are clear, testable and agreed.',
      keyConcepts: [
        {
          id: 'k1',
          title: 'Functional requirements',
          explanation:
            'Behaviour the system must provide, such as "a student can add a note to a class".',
        },
        {
          id: 'k2',
          title: 'Non-functional requirements',
          explanation:
            'Qualities such as performance, security and usability, stated so they can be measured.',
        },
      ],
      confusionAreas: [
        {
          id: 'c1',
          issue: 'Is "the app should be fast" a requirement?',
          clarification:
            'Only once it is measurable, for example "search returns results in under 2 seconds".',
        },
      ],
      keyTopics: [
        { id: 't1', name: 'Functional requirements' },
        { id: 't2', name: 'Non-functional requirements' },
        { id: 't3', name: 'Measurability' },
      ],
      notesAnalyzedCount: 41,
      reviewedBy: TEACHERS.smith,
      publishedAt: minutesAgo(now, 2 * 60),
      viewedByMe: false,
    },
    {
      id: 'summary-eng-201-c1',
      classId: 'eng-201-c1',
      courseId: 'eng-201',
      overview:
        'A strong essay states its thesis early and uses every paragraph to support it, ending with a conclusion that shows why it matters.',
      keyConcepts: [
        {
          id: 'k1',
          title: 'Thesis statement',
          explanation: 'One sentence that states the argument the whole essay supports.',
        },
      ],
      confusionAreas: [
        {
          id: 'c1',
          issue: 'Can a topic sentence be a question?',
          clarification: 'It can, but a clear statement usually guides the reader better.',
        },
      ],
      keyTopics: [
        { id: 't1', name: 'Thesis' },
        { id: 't2', name: 'Paragraph structure' },
      ],
      notesAnalyzedCount: 52,
      reviewedBy: TEACHERS.adeyemi,
      publishedAt: minutesAgo(now, 24 * 60),
      viewedByMe: false,
    },
  ]
}

/** Eight notifications across the four types, three unread. */
function buildNotifications(now: Date): AppNotification[] {
  return [
    {
      id: 'n1',
      type: 'note',
      title: 'Note saved',
      body: 'Your note "Waterfall in one line" was added to SDLC Models.',
      link: '/notes/note-7',
      createdAt: minutesAgo(now, 25),
      read: true,
    },
    {
      id: 'n2',
      type: 'summary',
      title: 'New summary: Software Requirements',
      body: 'Dr. Smith published the summary for SWE 311, class 2.',
      link: '/courses/swe-311/classes/swe-311-c2/summary',
      createdAt: minutesAgo(now, 2 * 60),
      read: false,
    },
    {
      id: 'n3',
      type: 'message',
      title: 'Bring laptops on Wednesday',
      body: 'Dr. Smith: we will sketch a requirements document in class.',
      link: '/courses/swe-311',
      createdAt: minutesAgo(now, 5 * 60),
      read: false,
    },
    {
      id: 'n4',
      type: 'summary',
      title: 'New summary: Essay Structure',
      body: 'Mrs. Adeyemi published the summary for ENG 201, class 1.',
      link: '/courses/eng-201/classes/eng-201-c1/summary',
      createdAt: minutesAgo(now, 24 * 60),
      read: false,
    },
    {
      id: 'n5',
      type: 'message',
      title: 'Room change for CSE 205',
      body: 'Dr. Bello: Thursday classes move to Lab 3.',
      link: '/courses/cse-205',
      createdAt: minutesAgo(now, 2 * 24 * 60),
      read: true,
    },
    {
      id: 'n6',
      type: 'system',
      title: 'Ask CoNote AI is here',
      body: 'Ask questions about your courses, answered from approved summaries and your notes.',
      link: '/ask-ai',
      createdAt: minutesAgo(now, 4 * 24 * 60),
      read: true,
    },
    {
      id: 'n7',
      type: 'summary',
      title: 'New summary: Introduction to Software Engineering',
      body: 'Dr. Smith published the summary for SWE 311, class 1.',
      link: '/courses/swe-311/classes/swe-311-c1/summary',
      createdAt: minutesAgo(now, 19 * 24 * 60),
      read: true,
    },
    {
      id: 'n8',
      type: 'system',
      title: 'Welcome to CoNote',
      body: 'Write your notes per class; your teacher approves every summary.',
      createdAt: minutesAgo(now, 25 * 24 * 60),
      read: true,
    },
  ]
}

/** The whole demo data set, relative to `now`. */
export function createSeed(now: Date): Seed {
  // Classes first, because the courses count them.
  const plans = buildClasses(now)
  return {
    courses: buildCourses(plans),
    classes: plans,
    notes: buildNotes(now),
    summaries: buildSummaries(now),
    notifications: buildNotifications(now),
  }
}

/** One day in milliseconds, exported for tests that move the clock. */
export const ONE_DAY_MS = DAY
