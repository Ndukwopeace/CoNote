/**
 * Reading the signed-in person's `profiles` row and turning it into the user the apps use.
 * Shared by every app's Supabase auth service.
 */

// The client type, for reading the row.
import type { SupabaseClient } from '@supabase/supabase-js'
// zod checks that the row has the shape we expect.
import { z } from 'zod'

// The shared role and status vocabulary.
import type { AccountStatus, Role } from '@conote/domain'

// Turns database and auth failures into the app's error type.
import { fromSupabaseError } from './errors'

/** The columns every app reads to know who is signed in. */
export const PROFILE_COLUMNS = 'id, role, status, full_name, email, avatar_url'

// SECURITY: database rows are not trusted blindly. An unknown role or status must not reach the
// route guards, so anything that does not match is refused.
const profileRowSchema = z.object({
  // Non-empty account ID.
  id: z.string().min(1),
  // Only the three known roles.
  role: z.enum(['student', 'teacher', 'admin']),
  // Only the four known statuses.
  status: z.enum(['active', 'inactive', 'suspended', 'pending']),
  // The name may be blank for an account that has not set one.
  full_name: z.string(),
  // A well-formed email.
  email: z.email(),
  // Optional picture address.
  avatar_url: z.string().nullable(),
})

/** A checked `profiles` row. */
export interface ProfileRow {
  id: string
  role: Role
  status: AccountStatus
  full_name: string
  email: string
  avatar_url: string | null
}

/** The person as the apps see them once signed in. */
export interface SignedInUser {
  id: string
  role: Role
  fullName: string
  email: string
  avatarUrl?: string
}

/** Checks a row from the database. Throws if it is malformed. */
export function parseProfileRow(row: unknown): ProfileRow {
  return profileRowSchema.parse(row)
}

/** Builds the signed-in user from a checked row. */
export function toSessionUser(row: ProfileRow): SignedInUser {
  // A blank name falls back to the part of the email before the "@", so greetings are never empty.
  const fullName = row.full_name.trim() || (row.email.split('@')[0] ?? row.email)
  const user: SignedInUser = { id: row.id, role: row.role, fullName, email: row.email }
  // Only include the picture when there is one (the strict optional-type rule requires this).
  return row.avatar_url === null ? user : { ...user, avatarUrl: row.avatar_url }
}

/**
 * Reads the profile of account `id`. Row Level Security lets a person read only their own row
 * (and an administrator read any), so this works for the signed-in user.
 */
export async function fetchProfile(client: SupabaseClient, id: string): Promise<ProfileRow> {
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', id)
    .single()
  // A missing or refused row becomes an AppError (not_found, forbidden, network...).
  if (error) throw fromSupabaseError(error)
  try {
    // SECURITY: the row is checked before the app trusts its role or status.
    return parseProfileRow(data)
  } catch (cause) {
    // A row of the wrong shape is a server problem, not something to show.
    throw fromSupabaseError({ message: 'Malformed profile row', cause })
  }
}
