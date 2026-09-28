/**
 * Test data factories (ENGINEERING_STANDARDS.md 2.4). Tests build data here instead of copying
 * object literals, so a change to a type is fixed in one place.
 */

// The shapes being built.
import type { Session, SessionUser } from '@/types/auth'
// Course and class shapes.
import type { ClassSession, Course } from '@/types/domain'

/** Test data factories (ENGINEERING_STANDARDS.md 2.4). Override only what a test cares about. */
export function makeSessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    // Default: a student called Victory.
    id: 'student-1',
    role: 'student',
    fullName: 'Victory Okafor',
    email: 'victory@example.com',
    // Anything the test passes replaces the defaults above.
    ...overrides,
  }
}

/** A signed-in session for the user built above. */
export function makeSession(overrides: Partial<SessionUser> = {}): Session {
  // Wrap the user in a session.
  return { user: makeSessionUser(overrides) }
}

/** A course. Override only what a test cares about. */
export function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    // Default: an ongoing SWE 311 with a named teacher.
    id: 'course-1',
    code: 'SWE 311',
    title: 'Software Engineering',
    description: 'Principles of building software in teams.',
    teacher: { id: 'teacher-1', fullName: 'Dr. Smith' },
    studentCount: 48,
    classCount: 4,
    status: 'ongoing',
    // Anything the test passes replaces the defaults above.
    ...overrides,
  }
}

/** A class session, tomorrow 9–11 AM by default. Override only what a test cares about. */
export function makeClass(overrides: Partial<ClassSession> = {}): ClassSession {
  // Tomorrow at 9 AM and 11 AM, local time, so the default is always "upcoming".
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(9, 0, 0, 0)
  const end = new Date(start)
  end.setHours(11)
  return {
    // Default: class 1 of course-1, still collecting notes.
    id: 'class-1',
    courseId: 'course-1',
    number: 1,
    title: 'Introduction to Software Engineering',
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    summaryStatus: 'collecting',
    // Anything the test passes replaces the defaults above.
    ...overrides,
  }
}
