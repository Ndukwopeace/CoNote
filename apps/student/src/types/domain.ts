/** Domain types (REQUIREMENTS.md section 12). The UI sees only these shapes. */

// The vocabulary shared by every CoNote app: roles and statuses (packages/domain, D64).
// Imported for use below and re-exported, so the app keeps importing everything from here.
import type { CourseStatus, NotificationType, Role, SummaryStatus } from '@conote/domain'

export type { CourseStatus, NotificationType, Role, SummaryStatus }

/** Which notifications a student wants, and where (FR-SET-3). */
export interface NotificationPrefs {
  // "A summary was published" alerts.
  summaryPublished: { inApp: boolean; email: boolean }
  // Upcoming-class reminders.
  classReminders: { inApp: boolean; email: boolean }
  // Teacher and admin announcements.
  announcements: { inApp: boolean; email: boolean }
}

/** The student's full profile (Settings → Profile). */
export interface StudentProfile {
  // Account ID.
  id: string
  // Always "student" for people who get past the guards.
  role: Role
  // Display name.
  fullName: string
  // Sign-in email; read-only on the profile tab.
  email: string
  // Optional picture.
  avatarUrl?: string
  // Optional department, e.g. Computer Science.
  department?: string
  // Optional level or year.
  level?: string
  // Optional phone number.
  phone?: string
  // Notification settings.
  notificationPrefs: NotificationPrefs
}

/** A course's teacher, as students see them. */
export interface Teacher {
  // Teacher account ID.
  id: string
  // Shown on course cards and summaries.
  fullName: string
  // Optional picture.
  avatarUrl?: string
}

/** A course the student is enrolled in. */
export interface Course {
  // Course ID.
  id: string
  // Short code, e.g. "SWE 311".
  code: string
  // Full title.
  title: string
  // Overview text.
  description: string
  // Who teaches it.
  teacher: Teacher
  // Enrolled students, shown on the card.
  studentCount: number
  // Number of class sessions.
  classCount: number
  // Term status badge.
  status: CourseStatus
  // Free-text schedule, e.g. "Mon & Wed, 9–11am".
  scheduleText?: string
}

/** One dated lesson inside a course. */
export interface ClassSession {
  // Class ID.
  id: string
  // The course it belongs to.
  courseId: string
  // Position in the course, e.g. 2 for "2. Software Requirements".
  number: number
  // Lesson title.
  title: string
  // Optional description.
  description?: string
  /** ISO 8601. Live / upcoming / completed is computed from these, never stored. */
  startsAt: string
  // ISO 8601 end time.
  endsAt: string
  // Summary stage. Students see content only when "published".
  summaryStatus: SummaryStatus
}

/** A student's private note. Only its author can read it. */
export interface Note {
  // Note ID.
  id: string
  // Author. Row Level Security will allow access only when this is the signed-in student.
  studentId: string
  // Course, kept for filtering.
  courseId: string
  // Class the note was written for.
  classId: string
  // Optional title.
  title?: string
  // Rich-text body. Always shown through SafeHtml, never inserted directly.
  contentHtml: string
  // Tags such as "Question" or "Key concept".
  tags: string[]
  // ISO 8601 creation time.
  createdAt: string
  // ISO 8601 last edit time.
  updatedAt: string
}

/** A teacher-approved class summary. Students only ever receive published ones. */
export interface Summary {
  // Summary ID.
  id: string
  // The class it summarises.
  classId: string
  // The course, for filtering.
  courseId: string
  // Opening paragraph.
  overview: string
  // Main ideas, each with an explanation.
  keyConcepts: { id: string; title: string; explanation: string }[]
  // Where students were confused, each with the approved clarification.
  confusionAreas: { id: string; issue: string; clarification: string }[]
  // Topic list for the Key Topics tab.
  keyTopics: { id: string; name: string; description?: string }[]
  // How many notes the AI read, shown as "Based on n student notes".
  notesAnalyzedCount: number
  // The approving teacher.
  reviewedBy: Teacher
  // ISO 8601 publish time.
  publishedAt: string
  // Whether this student has opened it (drives the "New Summaries" count).
  viewedByMe: boolean
}

/** One notification. */
export interface AppNotification {
  // Notification ID.
  id: string
  // Category.
  type: NotificationType
  // Headline.
  title: string
  // Detail text.
  body: string
  // In-app path to open when clicked.
  link?: string
  // ISO 8601 time.
  createdAt: string
  // Whether the student has seen it.
  read: boolean
}

/** What an Ask AI conversation is about (FR-AI-2). */
export interface AiContext {
  // Everything, one course, or one class.
  scope: 'all' | 'course' | 'class'
  // Set when scope is "course" or "class".
  courseId?: string
  // Set when scope is "class".
  classId?: string
}

/** One message in an Ask AI conversation. */
export interface AiMessage {
  // Message ID.
  id: string
  // Who wrote it.
  role: 'user' | 'assistant'
  // Plain text. Never rendered as HTML (ENGINEERING_STANDARDS.md 6.1).
  content: string
  // ISO 8601 time.
  createdAt: string
}
