/**
 * The profile picture check (FR-SET-1): JPG or PNG, 2 MB at most.
 */

/** Largest picture accepted: 2 MB. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024

/**
 * Picture types accepted.
 * SECURITY: SVG is left out on purpose: it is XML that can carry scripts. The upload service
 * checks the type again on the server side.
 */
const ALLOWED_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png'])

/** Why a picture can't be used, or null if it can. */
export function avatarProblem(file: Pick<File, 'type' | 'size'>): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return 'Choose a JPG or PNG image.'
  if (file.size > MAX_AVATAR_BYTES) return 'Choose an image of 2 MB or less.'
  return null
}
