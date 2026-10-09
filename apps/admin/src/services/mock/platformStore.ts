/**
 * Saves the demo platform's changeable records (users, courses, resources, classes with their summaries and jobs, enrolments, audit log) in local storage,
 * so changes survive a reload as server data would. Sign-out leaves them, like a real server.
 */

// Shape checks for what is read back.
import { z } from 'zod'

// The records.
import type { PlatformData } from '../platformData'

// The demo data's storage prefix.
import { DEMO_DATA_PREFIX } from './mockAuthService'

/** Where the saved records live. */
export const PLATFORM_KEY = `${DEMO_DATA_PREFIX}platform`

/** What a saved user must look like. */
const userSchema = z.object({
  id: z.string(),
  role: z.enum(['student', 'teacher', 'admin']),
  status: z.enum(['active', 'inactive', 'suspended', 'pending']),
  fullName: z.string(),
  email: z.string(),
  studentNumber: z.string().nullable(),
  staffNumber: z.string().nullable(),
  department: z.string().nullable(),
  level: z.string().nullable(),
  phone: z.string().nullable(),
  createdAt: z.string(),
  lastActiveAt: z.string().nullable(),
})

/** What a saved course must look like. */
const courseSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
  department: z.string().nullable(),
  status: z.enum(['upcoming', 'ongoing', 'completed']),
  teacherId: z.string().nullable(),
  createdAt: z.string(),
  archivedAt: z.string().nullable(),
})

/** What a saved resource must look like. */
const resourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['pdf', 'document', 'slides', 'video', 'link']),
  courseId: z.string(),
  classId: z.string().nullable(),
  status: z.enum(['draft', 'published', 'archived']),
  createdAt: z.string(),
})

/** What a saved class must look like. */
const classSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  number: z.number(),
  title: z.string(),
  description: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  noteCount: z.number(),
  archivedAt: z.string().nullable(),
})

/** What a saved summary must look like. */
const summarySchema = z.object({
  id: z.string(),
  classId: z.string(),
  status: z.enum(['collecting', 'processing', 'in_review', 'published']),
  inReviewSince: z.string().nullable(),
  publishedAt: z.string().nullable(),
})

/** What a saved AI job must look like. */
const aiJobSchema = z.object({
  id: z.string(),
  classId: z.string(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  createdAt: z.string(),
  attempt: z.number(),
  finishedAt: z.string().nullable(),
})

/** What a saved enrolment request must look like. */
const enrollmentRequestSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  studentId: z.string(),
  status: z.enum(['pending', 'approved', 'declined', 'cancelled']),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
  decidedBy: z.string().nullable(),
})

/** What the saved records must look like. Courses and resources are optional so that records
 *  saved before the Courses milestone still load. */
const storedSchema = z.object({
  courses: z.array(courseSchema).optional(),
  resources: z.array(resourceSchema).optional(),
  // Classes, with the summaries and jobs that describe them, are saved and restored together.
  classes: z.array(classSchema).optional(),
  summaries: z.array(summarySchema).optional(),
  aiJobs: z.array(aiJobSchema).optional(),
  // Requests to join courses; absent in a save made before they existed.
  enrollmentRequests: z.array(enrollmentRequestSchema).optional(),
  users: z.array(userSchema),
  enrollments: z.array(z.object({ courseId: z.string(), studentId: z.string() })),
  auditLog: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      actorId: z.string().nullable(),
      action: z.string(),
      entityType: z.string(),
      entityId: z.string(),
      metadata: z.record(z.string(), z.string().nullable()),
    }),
  ),
})

/** `seed`, with any saved users, courses, resources, classes (with their summaries and jobs), enrolments and audit log in place of its own. */
export function loadPlatform(store: Storage, seed: PlatformData): PlatformData {
  // Nothing saved: the seed as it is.
  const raw = store.getItem(PLATFORM_KEY)
  if (raw === null) return seed
  // SECURITY: storage can be edited by hand, so its contents are checked before use.
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return seed
    // Courses and resources saved by an older version are absent: keep the seed's.
    const { courses, resources, classes, summaries, aiJobs, enrollmentRequests, ...saved } =
      parsed.data
    // Classes, summaries and jobs describe one another, so they are taken from the save together.
    const savedClasses = classes && summaries && aiJobs
    return {
      ...seed,
      ...saved,
      courses: courses ?? seed.courses,
      resources: resources ?? seed.resources,
      classes: savedClasses ? classes : seed.classes,
      summaries: savedClasses ? summaries : seed.summaries,
      aiJobs: savedClasses ? aiJobs : seed.aiJobs,
      enrollmentRequests: enrollmentRequests ?? seed.enrollmentRequests,
    }
  } catch {
    // Not JSON.
    return seed
  }
}

/** Saves `data`'s users, courses, resources, classes (with their summaries and jobs), enrolments and audit log. */
export function savePlatform(store: Storage, data: PlatformData) {
  // Only the records that change; everything else comes from the seed each time.
  const {
    users,
    courses,
    resources,
    classes,
    summaries,
    aiJobs,
    enrollments,
    enrollmentRequests,
    auditLog,
  } = data
  store.setItem(
    PLATFORM_KEY,
    JSON.stringify({
      users,
      courses,
      resources,
      classes,
      summaries,
      aiJobs,
      enrollments,
      enrollmentRequests,
      auditLog,
    }),
  )
}
