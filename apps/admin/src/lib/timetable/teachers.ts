/**
 * Matching the teacher names a timetable gives ("Dr TCHOKOTE") to teacher accounts (D105). The
 * match only suggests: the administrator sees it, and can change it, before anything is created.
 */

/** An account a name can be matched to. */
export interface TeacherAccount {
  id: string
  fullName: string
}

/** How a name matched. */
export type TeacherMatch =
  { kind: 'match'; id: string } | { kind: 'ambiguous'; ids: string[] } | { kind: 'none' }

/** Titles a timetable puts before a name; they say nothing about who the person is. */
const TITLES = new Set([
  'dr',
  'prof',
  'professor',
  'mr',
  'mrs',
  'ms',
  'miss',
  'mme',
  'madame',
  'eng',
  'engr',
  'pr',
])

/** A name as lower-case words without titles, accents or punctuation. */
function words(name: string): string[] {
  return (
    name
      .normalize('NFD')
      // Drops the accent marks that decomposing leaves as separate characters.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word !== '' && !TITLES.has(word))
  )
}

/**
 * The account a timetable name belongs to. Every word of the name must appear in the account's
 * name, so "Dr TCHOKOTE" finds "Jean Paul Tchokote" and "Prof Peter NDAMBOMVE" tells two
 * Ndambomves apart. Two accounts that both fit are reported as ambiguous, never guessed.
 */
export function matchTeacher(name: string, accounts: readonly TeacherAccount[]): TeacherMatch {
  const wanted = words(name)
  // A title on its own would otherwise fit everybody.
  if (wanted.length === 0) return { kind: 'none' }
  const fits = accounts.filter((account) => {
    const have = new Set(words(account.fullName))
    return wanted.every((word) => have.has(word))
  })
  const [only] = fits
  if (fits.length === 1 && only) return { kind: 'match', id: only.id }
  if (fits.length > 1) return { kind: 'ambiguous', ids: fits.map((account) => account.id) }
  return { kind: 'none' }
}

/** What to preselect for a course, and what to tell the administrator about names that didn't fit. */
export interface TeacherSuggestion {
  teacherId: string | null
  // One line for each name that matched no account or several.
  notes: string[]
}

/**
 * The teacher to preselect for a course given the names the timetable has for it: the first name
 * that fits exactly one account. Names that fit none, or fit two, are described in `notes`, so the
 * administrator knows to choose.
 */
export function suggestTeacher(
  names: readonly string[],
  accounts: readonly TeacherAccount[],
): TeacherSuggestion {
  let teacherId: string | null = null
  const notes: string[] = []
  for (const name of names) {
    const found = matchTeacher(name, accounts)
    if (found.kind === 'match' && teacherId === null) teacherId = found.id
    else if (found.kind === 'ambiguous') notes.push(`More than one account fits "${name}".`)
    else if (found.kind === 'none') notes.push(`No account fits "${name}".`)
  }
  return { teacherId, notes }
}
