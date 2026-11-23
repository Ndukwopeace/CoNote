/**
 * A form's results by course and lecturer (D126): how many answers each has and the average of every
 * rating question, with an overall average across them. Counts and averages only; no names.
 */

// The rows and the questions.
import type { FormQuestion } from '@conote/core/forms'
import type { FormResultRow } from '@/types/forms'

/** The average of `values` to two places. */
function mean(values: readonly number[]): number {
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
}

/** The results table. */
export function ResultsTable({
  questions,
  rows,
}: Readonly<{ questions: readonly FormQuestion[]; rows: readonly FormResultRow[] }>) {
  // Only rating questions have an average.
  const ratings = questions.filter((question) => question.kind === 'rating')
  return (
    // A table wider than a phone scrolls sideways, so the box can take the keyboard focus and be scrolled by keys.
    <div
      role="region"
      aria-label="Results table"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a box that scrolls sideways must take focus, or a keyboard user cannot scroll it (axe: scrollable-region-focusable)
      tabIndex={0}
      className="overflow-x-auto rounded-xl border bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Results by course and lecturer</caption>
        <thead className="border-b text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Course
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Lecturer
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Responses
            </th>
            {ratings.map((question) => (
              <th key={question.id} scope="col" className="px-4 py-2 text-right font-medium">
                {question.prompt}
              </th>
            ))}
            {ratings.length > 1 && (
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Overall
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const averages = ratings.flatMap((question) => {
              const value = row.averages[question.id]
              return value === undefined ? [] : [value]
            })
            return (
              <tr key={`${row.courseCode ?? ''}|${row.lecturer ?? ''}`}>
                <td className="px-4 py-2">{row.courseCode ?? 'All'}</td>
                <td className="px-4 py-2">{row.lecturer ?? '–'}</td>
                <td className="px-4 py-2 text-right">{row.responses}</td>
                {ratings.map((question) => (
                  <td key={question.id} className="px-4 py-2 text-right">
                    {row.averages[question.id]?.toFixed(2) ?? '–'}
                  </td>
                ))}
                {ratings.length > 1 && (
                  <td className="px-4 py-2 text-right font-semibold">
                    {averages.length === 0 ? '–' : mean(averages).toFixed(2)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
