/**
 * Small rules the Forms pages share (D126): the template a new form starts from, turning a date and
 * time into and out of the browser's input, the link students open, how a state reads, and the CSV an
 * administrator downloads.
 */

// The question shapes.
import type { FormQuestion, FormQuestionDraft, FormState } from '@conote/core/forms'
// The answer shape.
import type { FormResponseItem } from '@/types/forms'

/** The questions a new form starts with: the lecturer assessment the school asked for. */
export const TEMPLATE_QUESTIONS: readonly FormQuestionDraft[] = [
  { kind: 'lecturer', prompt: 'Course and lecturer', required: true, options: [] },
  { kind: 'rating', prompt: 'Explains the material clearly', required: true, options: [] },
  { kind: 'rating', prompt: 'Is prepared for classes', required: true, options: [] },
  { kind: 'rating', prompt: 'Starts and ends classes on time', required: true, options: [] },
  { kind: 'rating', prompt: 'Treats students with respect', required: true, options: [] },
  { kind: 'rating', prompt: 'Gives useful feedback on work', required: true, options: [] },
  { kind: 'paragraph', prompt: 'What could improve?', required: false, options: [] },
]

/** How a form's state reads. */
export function stateLabel(state: FormState): string {
  if (state === 'open') return 'Open'
  if (state === 'not_open') return 'Opens later'
  return 'Closed'
}

/** An ISO time as the `datetime-local` input wants it, in the administrator's own time zone. */
export function toLocalInput(iso: string | null): string {
  if (iso === null) return ''
  const date = new Date(iso)
  // Two-digit parts, so the text sorts and parses.
  const part = (value: number) => String(value).padStart(2, '0')
  return `${String(date.getFullYear())}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`
}

/** What the `datetime-local` input holds, as an ISO time; empty means no date. */
export function fromLocalInput(value: string): string | null {
  if (value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * The link students open for a form. With the student site's address (`VITE_STUDENT_APP_URL`) it is a
 * full address; without it, only the path, which the administrator adds to that address.
 */
export function publicFormPath(token: string, base?: string): string {
  const path = `/f/${encodeURIComponent(token)}`
  if (base === undefined || base === '') return path
  return `${base.replace(/\/+$/, '')}${path}`
}

/** `text` safe to open in a spreadsheet and to sit in one CSV cell. */
function csvCell(text: string): string {
  // SECURITY: a cell that starts with = + - or @ (or a tab or return) can run as a formula when a
  // spreadsheet opens the file, so someone who types one into a form could act on whoever reads it.
  // A leading apostrophe makes it plain text.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  // Quotes double inside a quoted cell; a cell with a comma, quote or line break is quoted.
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

/**
 * The answers as CSV: the time, the course and the lecturer, then one column per question that is not the
 * lecturer question. Rows are in the order given.
 */
export function responsesToCsv(
  questions: readonly FormQuestion[],
  responses: readonly FormResponseItem[],
): string {
  // The lecturer is in its own two columns, so its question has none.
  const columns = questions.filter((question) => question.kind !== 'lecturer')
  const header = ['Submitted', 'Course', 'Lecturer', ...columns.map((question) => question.prompt)]
  const rows = responses.map((response) => [
    response.createdAt,
    response.courseCode ?? '',
    response.lecturer ?? '',
    ...columns.map((question) => String(response.answers[question.id] ?? '')),
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}
