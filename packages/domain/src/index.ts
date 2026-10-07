/**
 * The shared CoNote vocabulary (decision D64): roles and statuses that the student, teacher and
 * admin apps, and later the database, must all spell the same way. Each app builds its own view
 * types on top of these. Changing a value here is a change for every app. Record IDs are plain
 * strings, so mock IDs and database UUIDs both fit.
 */

/** Account roles, as stored in `profiles.role`. Each app admits only its own role. */
export type Role = 'student' | 'teacher' | 'admin'

/** Where a course is in its term, as stored in `courses.status`. */
export type CourseStatus = 'upcoming' | 'ongoing' | 'completed'

/**
 * Where a class's summary is in its lifecycle (REQUIREMENTS.md section 4), as stored in
 * `class_sessions.summary_status`. Only a teacher moves a summary to "published".
 */
export type SummaryStatus = 'collecting' | 'processing' | 'in_review' | 'published'

/** Notification categories, as stored in `notifications.type`. */
export type NotificationType = 'summary' | 'system' | 'message' | 'note'
