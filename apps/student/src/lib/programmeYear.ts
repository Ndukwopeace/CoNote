/**
 * The year of a programme (D115). The timetable import names every programme "<course of study>-Y<year>",
 * with an optional track after it ("SWE-Y3", "CSN-Y3-CSDPE"), so the year is read from the code and
 * needs no column of its own. A code that does not follow the shape has no year.
 */

/** "-Y" and the digits, which end the code or are followed by a dash (a track). */
const YEAR_IN_CODE = /-Y(\d{1,2})(?:-|$)/i

/** The year `code` names, from 1 up, or null when it names none. */
export function programmeYear(code: string): number | null {
  // Look for the year part.
  const match = YEAR_IN_CODE.exec(code)
  // None: the programme belongs to no year.
  if (!match) return null
  // The digits, as a number.
  const year = Number(match[1])
  // Years start at 1; "Y0" is not a year.
  return year >= 1 ? year : null
}

/** The words for a year: "Year 3". */
export function yearLabel(year: number): string {
  return `Year ${String(year)}`
}
