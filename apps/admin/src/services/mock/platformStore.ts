/**
 * Saves the demo platform's changeable records (users, courses, resources, enrolments, audit log) in local storage,
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

/** What the saved records must look like. Courses and resources are optional so that records
 *  saved before the Courses milestone still load. */
const storedSchema = z.object({
  courses: z.array(courseSchema).optional(),
  resources: z.array(resourceSchema).optional(),
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

/** `seed`, with any saved users, courses, resources, enrolments and audit log in place of its own. */
export function loadPlatform(store: Storage, seed: PlatformData): PlatformData {
  // Nothing saved: the seed as it is.
  const raw = store.getItem(PLATFORM_KEY)
  if (raw === null) return seed
  // SECURITY: storage can be edited by hand, so its contents are checked before use.
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return seed
    // Courses and resources saved by an older version are absent: keep the seed's.
    const { courses, resources, ...saved } = parsed.data
    return {
      ...seed,
      ...saved,
      courses: courses ?? seed.courses,
      resources: resources ?? seed.resources,
    }
  } catch {
    // Not JSON.
    return seed
  }
}

/** Saves `data`'s users, courses, resources, enrolments and audit log. */
export function savePlatform(store: Storage, data: PlatformData) {
  // Only the records that change; everything else comes from the seed each time.
  const { users, courses, resources, enrollments, auditLog } = data
  store.setItem(PLATFORM_KEY, JSON.stringify({ users, courses, resources, enrollments, auditLog }))
}
