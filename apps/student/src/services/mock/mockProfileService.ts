/**
 * The demo profile service (FR-SET-1, FR-SET-3) and the demo reset (FR-SET-5). Profile changes
 * are kept in localStorage under the mock-data prefix, per student.
 */

// Checks stored and submitted values.
import { z } from 'zod'

// Picture rules.
import { avatarProblem } from '@/lib/avatar'
// The error type.
import { AppError } from '@conote/core/errors'
// Profile rules shared with the form.
import { DEFAULT_NOTIFICATION_PREFS, notificationPrefsSchema, profileSchema } from '@/lib/profile'
// The mock-data key prefix.
import { MOCK_DATA_PREFIX } from '@/lib/storage'
// Shapes.
import type { StudentProfile } from '@/types/domain'

// The interfaces implemented.
import type { ProfileService, ProfileUpdate } from '../types'

// The fake network delay.
import { simulateLatency } from './latency'
// The demo auth service, for the signed-in identity and renaming.
import type { MockAuthService } from './mockAuthService'

/** Where profile changes are kept. */
const PROFILE_KEY = `${MOCK_DATA_PREFIX}profile`

/**
 * A profile picture address the app will show.
 * SECURITY: only a JPG or PNG data address (as made by uploadAvatar) is accepted, so a crafted
 * request can't set a "javascript:" address, an SVG with scripts, or an outside image that
 * tracks who views it. The real backend stores the file and returns its own address.
 */
const avatarUrlSchema = z
  .string()
  .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, 'Choose a JPG or PNG image.')

/** What is stored per student. Name and email come from the session unless changed here. */
const storedSchema = z.object({
  fullName: z.string().optional(),
  department: z.string().default(''),
  level: z.string().default(''),
  phone: z.string().default(''),
  avatarUrl: avatarUrlSchema.optional(),
  notificationPrefs: notificationPrefsSchema.default(DEFAULT_NOTIFICATION_PREFS),
})
/** The stored record type. */
type Stored = z.output<typeof storedSchema>

/** What the factory needs. */
interface MockProfileOptions {
  // The demo auth service: who is signed in, and renaming.
  auth: MockAuthService
  // Where changes are kept; tests pass localStorage too.
  store: Pick<Storage, 'getItem' | 'setItem'>
  // Delay per call; tests pass 0.
  latencyMs: number
}

/** Builds the demo profile service. */
export function createMockProfileService({
  auth,
  store,
  latencyMs,
}: MockProfileOptions): ProfileService {
  /** Every student's stored record, by ID. Unusable storage counts as empty. */
  function readAll(): Record<string, unknown> {
    try {
      const raw = store.getItem(PROFILE_KEY)
      const parsed: unknown = raw === null ? {} : JSON.parse(raw)
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }

  /** One student's stored record; tampered data falls back to the defaults. */
  function read(studentId: string): Stored {
    const parsed = storedSchema.safeParse(readAll()[studentId] ?? {})
    return parsed.success ? parsed.data : storedSchema.parse({})
  }

  /** The signed-in student, or unauthorized. */
  async function currentUser() {
    const session = await auth.getSession()
    if (!session) throw new AppError('unauthorized', 'Not signed in')
    return session.user
  }

  /** The profile for the signed-in student. */
  async function me(): Promise<StudentProfile> {
    const user = await currentUser()
    const stored = read(user.id)
    return {
      id: user.id,
      role: user.role,
      email: user.email,
      fullName: stored.fullName ?? user.fullName,
      department: stored.department,
      level: stored.level,
      phone: stored.phone,
      notificationPrefs: stored.notificationPrefs,
      ...(stored.avatarUrl ? { avatarUrl: stored.avatarUrl } : {}),
    }
  }

  return {
    getMe: async () => {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      return me()
    },

    updateMe: async (changes: ProfileUpdate) => {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      const user = await currentUser()
      // SECURITY: the same rules as the form, checked here too; the first problem is the message.
      const checked = z
        .object({
          ...profileSchema.partial().shape,
          avatarUrl: avatarUrlSchema.optional(),
          notificationPrefs: notificationPrefsSchema.optional(),
        })
        .safeParse(changes)
      if (!checked.success) {
        throw new AppError(
          'validation',
          checked.error.issues[0]?.message ?? 'Check your details and try again.',
        )
      }
      // Merge and save under this student.
      // The cast is safe: stripUndefined removed every undefined value.
      const next: Stored = {
        ...read(user.id),
        ...(stripUndefined(checked.data) as Partial<Stored>),
      }
      try {
        store.setItem(PROFILE_KEY, JSON.stringify({ ...readAll(), [user.id]: next }))
      } catch {
        throw new AppError('unknown', 'Could not save the profile')
      }
      // A new name reaches the navigation straight away.
      if (checked.data.fullName !== undefined) auth.updateDisplayName(checked.data.fullName)
      return me()
    },

    uploadAvatar: async (file) => {
      // Behave like a network call.
      await simulateLatency(latencyMs)
      // SECURITY: the picture rules again, whatever the page allowed.
      const problem = avatarProblem(file)
      if (problem) throw new AppError('validation', problem)
      // The demo keeps the picture as a data address; the real backend returns a storage URL.
      return readAsDataUrl(file)
    },
  }
}

/** The object without undefined values, so a partial update never erases a field. */
function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}

/** Reads a file as a data address. */
function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // readAsDataURL always gives a string; anything else is a failed read.
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new AppError('unknown', 'Could not read the picture'))
    }
    reader.onerror = () => {
      reject(new AppError('unknown', 'Could not read the picture'))
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Removes every demo change (notes, profile, viewed and read state), so the demo starts from its
 * seed again (FR-SET-5). The session and drafts are left alone.
 */
export function resetDemoData(store: Storage) {
  // Collect first: removing while walking by index skips keys.
  const keys = Array.from({ length: store.length }, (_, i) => store.key(i)).filter(
    (key): key is string => key?.startsWith(MOCK_DATA_PREFIX) ?? false,
  )
  for (const key of keys) store.removeItem(key)
}
