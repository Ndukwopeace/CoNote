/**
 * Saves the demo platform's changeable records (users, enrolments, audit log) in local storage,
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

/** What the saved records must look like. */
const storedSchema = z.object({
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

/** `seed`, with any saved users, enrolments and audit log in place of its own. */
export function loadPlatform(store: Storage, seed: PlatformData): PlatformData {
  // Nothing saved: the seed as it is.
  const raw = store.getItem(PLATFORM_KEY)
  if (raw === null) return seed
  // SECURITY: storage can be edited by hand, so its contents are checked before use.
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw))
    return parsed.success ? { ...seed, ...parsed.data } : seed
  } catch {
    // Not JSON.
    return seed
  }
}

/** Saves `data`'s users, enrolments and audit log. */
export function savePlatform(store: Storage, data: PlatformData) {
  // Only the records that change; everything else comes from the seed each time.
  const { users, enrollments, auditLog } = data
  store.setItem(PLATFORM_KEY, JSON.stringify({ users, enrollments, auditLog }))
}
