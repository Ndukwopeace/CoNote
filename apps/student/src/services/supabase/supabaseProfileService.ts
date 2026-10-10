/**
 * The signed-in student's profile on Supabase (milestone B2, FR-SET-1, FR-SET-3). Row Level
 * Security lets a person read and change only their own row, and only the columns they may edit
 * (never `role` or `status`), so this service adds no extra owner check beyond naming the row.
 * Profile pictures wait for file storage (see uploadAvatar).
 */

// The client type, and zod to check what comes back and what is submitted.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// The error type every service throws, and the error reporter.
import { AppError } from '@conote/core/errors'
import { reportError } from '@conote/core/reportError'

// The picture rules.
import { avatarProblem } from '@/lib/avatar'
// The profile rules shared with the form.
import { DEFAULT_NOTIFICATION_PREFS, notificationPrefsSchema, profileSchema } from '@/lib/profile'
// The profile shape.
import type { StudentProfile } from '@/types/domain'

// The interfaces this implementation must satisfy.
import type { ProfileService } from '../types'

// Reads and checks rows.
import { readOne } from './rows'

// The columns of a profile the page shows.
const COLUMNS =
  'id, role, full_name, email, avatar_url, department, level, phone, notification_prefs'

// SECURITY: the row is checked on arrival, so an unknown role never reaches a screen.
const profileRow = z.object({
  id: z.string(),
  role: z.enum(['student', 'teacher', 'admin']),
  full_name: z.string(),
  email: z.string(),
  avatar_url: z.string().nullable(),
  department: z.string().nullable(),
  level: z.string().nullable(),
  phone: z.string().nullable(),
  // Read leniently below: anything of the wrong shape falls back to the defaults.
  notification_prefs: z.unknown(),
})

// What a person may submit. Pictures are not accepted here yet (see below).
const updateSchema = z.object({
  ...profileSchema.partial().shape,
  notificationPrefs: notificationPrefsSchema.optional(),
})

// Shown for a request to set or upload a picture, until file storage is connected.
const NO_PICTURES = "Profile pictures aren't available yet."

/** What the factory needs. */
interface SupabaseProfileOptions {
  // The one client the app uses.
  client: SupabaseClient
  // Called after the name changes, so the navigation shows the new name straight away.
  afterNameChange: () => Promise<void>
}

/** Builds the Supabase profile service. */
export function createSupabaseProfileService({
  client,
  afterNameChange,
}: SupabaseProfileOptions): ProfileService {
  /** The signed-in person's ID, or unauthorized. */
  async function currentId(): Promise<string> {
    // The session is kept in this browser; no request is needed to read who is signed in.
    const { data } = await client.auth.getSession()
    if (!data.session) throw new AppError('unauthorized', 'Not signed in')
    return data.session.user.id
  }

  /** One row as the app's profile. Blank optional text is left out. */
  function toProfile(row: z.infer<typeof profileRow>): StudentProfile {
    const prefs = notificationPrefsSchema.safeParse(row.notification_prefs)
    const profile: StudentProfile = {
      id: row.id,
      role: row.role,
      fullName: row.full_name,
      email: row.email,
      notificationPrefs: prefs.success ? prefs.data : DEFAULT_NOTIFICATION_PREFS,
    }
    // Optional fields are included only when they have text.
    if (row.avatar_url) profile.avatarUrl = row.avatar_url
    if (row.department) profile.department = row.department
    if (row.level) profile.level = row.level
    if (row.phone) profile.phone = row.phone
    return profile
  }

  /** Reads the profile of account `id`. */
  async function read(id: string): Promise<StudentProfile> {
    const row = await readOne(
      client.from('profiles').select(COLUMNS).eq('id', id).maybeSingle(),
      profileRow,
    )
    if (!row) throw new AppError('not_found', 'Profile not found')
    return toProfile(row)
  }

  return {
    async getMe() {
      return read(await currentId())
    },

    async updateMe(changes) {
      const id = await currentId()
      // SECURITY: the same rules as the form, checked here too; the first problem is the message.
      // A picture address is refused: nothing in the app can make a trustworthy one yet, and a
      // stored address is loaded by every screen that shows the person.
      if (changes.avatarUrl !== undefined) throw new AppError('validation', NO_PICTURES)
      const checked = updateSchema.safeParse(changes)
      if (!checked.success) {
        throw new AppError(
          'validation',
          checked.error.issues[0]?.message ?? 'Check your details and try again.',
        )
      }
      const values = checked.data
      // Only what was given is written; blank optional text is stored as nothing.
      const payload: Record<string, unknown> = {}
      if (values.fullName !== undefined) payload.full_name = values.fullName
      if (values.department !== undefined) payload.department = values.department || null
      if (values.level !== undefined) payload.level = values.level || null
      if (values.phone !== undefined) payload.phone = values.phone || null
      if (values.notificationPrefs !== undefined)
        payload.notification_prefs = values.notificationPrefs
      // Nothing to change.
      if (Object.keys(payload).length === 0) return read(id)
      const row = await readOne(
        client.from('profiles').update(payload).eq('id', id).select(COLUMNS).maybeSingle(),
        profileRow,
      )
      // Row Level Security hides every other row, so no row back means none of theirs changed.
      if (!row) throw new AppError('not_found', 'Profile not found')
      // A new name reaches the navigation. A failure here must not undo the save.
      if (values.fullName !== undefined) {
        try {
          await afterNameChange()
        } catch (error) {
          reportError(error, { where: 'profile name refresh' })
        }
      }
      return toProfile(row)
    },

    uploadAvatar(file) {
      // SECURITY: the picture rules again, whatever the page allowed.
      const problem = avatarProblem(file)
      if (problem) return Promise.reject(new AppError('validation', problem))
      // Pictures need file storage, which is not connected yet.
      return Promise.reject(new AppError('validation', NO_PICTURES))
    },
  }
}
