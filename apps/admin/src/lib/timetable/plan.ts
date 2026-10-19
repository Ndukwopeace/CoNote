/**
 * Turns the pages of a timetable into the plan an administrator reviews before anything is
 * created (D105): programmes by programme, year and track; courses found once by code; and
 * warnings where the timetable disagrees with itself.
 */

// The shapes read and produced.
import type {
  ParsedPage,
  PlannedCourse,
  PlannedProgramme,
  PlannedSlot,
  TimetablePlan,
} from './types'

/** The longest a programme code may be (the database's limit). */
const MAX_CODE = 20
/** The most letters a track adds to a code. */
const MAX_INITIALS = 6
/** The longest a programme name may be (the database's limit). */
const MAX_NAME = 100

/** The first letters of a track's words, upper-case: "Applied AI Engineering & MLOps" is "AAEM". */
function initials(track: string): string {
  return (
    track
      .split(/\s+/)
      // A word such as "&" has no letter to give.
      .map((word) => /[A-Za-z0-9]/.exec(word)?.[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, MAX_INITIALS)
  )
}

/** A page's programme code: "SWE-Y1", or "SWE-Y3-AAEM" when the page has a track. */
export function programmeCode(page: ParsedPage): string {
  const short = page.shortCode.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const base = `${short}-Y${String(page.year)}`
  const track = page.track ? initials(page.track) : ''
  return (track === '' ? base : `${base}-${track}`).slice(0, MAX_CODE)
}

/** A page's programme name: "Software Engineering · Year 3 · DevOps, Cloud & Platform Engineering". */
function programmeName(page: ParsedPage): string {
  return [page.programmeName, `Year ${String(page.year)}`, page.track]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
    .slice(0, MAX_NAME)
}

/** A slot as a key, to count each distinct slot once. */
function slotKey(slot: PlannedSlot): string {
  return `${String(slot.weekday)} ${slot.start} ${slot.end} ${slot.title}`
}

/** Reads the pages into one plan. */
export function buildPlan(pages: readonly ParsedPage[]): TimetablePlan {
  const programmes = new Map<string, { name: string; codes: Set<string> }>()
  const courses = new Map<
    string,
    { title: string; titles: string[]; teachers: string[]; slots: Map<string, PlannedSlot> }
  >()
  const warnings = new Set<string>()
  const ignored = new Set<string>()

  for (const page of pages) {
    const code = programmeCode(page)
    // Two pages for one programme and year are one programme.
    const programme = programmes.get(code) ?? {
      name: programmeName(page),
      codes: new Set<string>(),
    }
    programmes.set(code, programme)
    for (const text of page.ignored) ignored.add(text)

    for (const block of page.blocks) {
      programme.codes.add(block.courseCode)
      const course = courses.get(block.courseCode) ?? {
        title: block.courseTitle,
        titles: [block.courseTitle],
        teachers: [],
        slots: new Map<string, PlannedSlot>(),
      }
      courses.set(block.courseCode, course)
      // The first title is the course's; any other is noted, and kept on its own slots.
      if (!course.titles.includes(block.courseTitle)) course.titles.push(block.courseTitle)
      if (block.teacherName && !course.teachers.includes(block.teacherName)) {
        course.teachers.push(block.teacherName)
      }
      const slot = {
        weekday: block.weekday,
        start: block.start,
        end: block.end,
        title: block.courseTitle,
      }
      course.slots.set(slotKey(slot), slot)
    }
  }

  const plannedCourses: PlannedCourse[] = [...courses.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, course]) => {
      if (course.titles.length > 1) {
        const titles = course.titles.map((title) => `"${title}"`)
        const last = titles.pop()
        warnings.add(
          `${code} is used for more than one activity: ${titles.join(', ')} and ${last ?? ''}. The course is titled "${course.title}"; each class is named after its own title.`,
        )
      }
      if (course.teachers.length > 1) {
        const count =
          course.teachers.length === 2
            ? 'two teachers'
            : `${String(course.teachers.length)} teachers`
        warnings.add(
          `${code} has ${count} in the timetable (${course.teachers.join(', ')}). Choose one below.`,
        )
      }
      return {
        code,
        title: course.title,
        teacherNames: course.teachers,
        // Week order: by day, then by start time.
        slots: [...course.slots.values()].sort(
          (a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start),
        ),
      }
    })
  const plannedProgrammes: PlannedProgramme[] = [...programmes.entries()].map(
    ([code, programme]) => ({
      code,
      name: programme.name,
      courseCodes: [...programme.codes].sort((a, b) => a.localeCompare(b)),
    }),
  )
  return {
    programmes: plannedProgrammes,
    courses: plannedCourses,
    warnings: [...warnings],
    ignored: [...ignored],
  }
}
