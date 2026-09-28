/** Domain types (REQUIREMENTS.md section 12). The UI sees only these shapes. */

export type ID = string

export type Role = 'student' | 'teacher' | 'admin'

export interface NotificationPrefs {
  summaryPublished: { inApp: boolean; email: boolean }
  classReminders: { inApp: boolean; email: boolean }
  announcements: { inApp: boolean; email: boolean }
}

export interface StudentProfile {
  id: ID
  role: Role
  fullName: string
  email: string
  avatarUrl?: string
  department?: string
  level?: string
  phone?: string
  notificationPrefs: NotificationPrefs
}

export interface Teacher {
  id: ID
  fullName: string
  avatarUrl?: string
}

export type CourseStatus = 'upcoming' | 'ongoing' | 'completed'

export interface Course {
  id: ID
  code: string
  title: string
  description: string
  teacher: Teacher
  studentCount: number
  classCount: number
  status: CourseStatus
  scheduleText?: string
}

export type SummaryStatus = 'collecting' | 'processing' | 'in_review' | 'published'

export interface ClassSession {
  id: ID
  courseId: ID
  number: number
  title: string
  description?: string
  /** ISO 8601. Live / upcoming / completed is computed from these, never stored. */
  startsAt: string
  endsAt: string
  summaryStatus: SummaryStatus
}

export interface Note {
  id: ID
  studentId: ID
  courseId: ID
  classId: ID
  title?: string
  contentHtml: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface Summary {
  id: ID
  classId: ID
  courseId: ID
  overview: string
  keyConcepts: { id: ID; title: string; explanation: string }[]
  confusionAreas: { id: ID; issue: string; clarification: string }[]
  keyTopics: { id: ID; name: string; description?: string }[]
  notesAnalyzedCount: number
  reviewedBy: Teacher
  publishedAt: string
  viewedByMe: boolean
}

export type NotificationType = 'summary' | 'system' | 'message' | 'note'

export interface AppNotification {
  id: ID
  type: NotificationType
  title: string
  body: string
  link?: string
  createdAt: string
  read: boolean
}

export interface AiContext {
  scope: 'all' | 'course' | 'class'
  courseId?: ID
  classId?: ID
}

export interface AiMessage {
  id: ID
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}
