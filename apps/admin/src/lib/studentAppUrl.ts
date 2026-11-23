/**
 * The address of the student site, where a public form opens (D126). It is a build-time setting,
 * `VITE_STUDENT_APP_URL` on the admin project. Without it the Forms pages show only the path.
 */

// Builds the link.
import { publicFormPath } from './forms'

// SECURITY: read by name, never as a whole `import.meta.env` (D122). It is a public address.
const raw: unknown = import.meta.env.VITE_STUDENT_APP_URL
const STUDENT_APP_URL = typeof raw === 'string' ? raw : undefined

/** The link students open for the form with this token. */
export function publicFormLink(token: string): string {
  return publicFormPath(token, STUDENT_APP_URL)
}

/** Whether the full address is known, or only the path. */
export function studentAppUrlKnown(): boolean {
  return STUDENT_APP_URL !== undefined && STUDENT_APP_URL !== ''
}
