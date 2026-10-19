/**
 * Import a timetable (D105): upload the school's timetable PDF, say which dates the term covers,
 * check what was found, and create the programmes, courses and classes in one go. Reading the PDF
 * happens in the browser, so the file never leaves the administrator's computer; only the checked
 * plan is sent.
 */

// Normalises anything thrown.
import { toAppError } from '@conote/core/errors'
// State.
import { useState } from 'react'

// Link back to the list, and the tab title.
import { Link } from 'react-router'
import { PageTitle } from '@conote/ui/common/PageTitle'
import { Skeleton } from '@conote/ui/skeleton'

// The three steps.
import { ImportDone } from '@/features/timetable/ImportDone'
import { ImportForm } from '@/features/timetable/ImportForm'
import {
  EMPTY_IMPORT_VALUES,
  type ImportFormValues,
  type ImportRequest,
} from '@/features/timetable/importFormValues'
import { ImportReview } from '@/features/timetable/ImportReview'
// The teachers to choose from.
import { useCourseFilterOptions } from '@/hooks/useCourses'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// Addresses.
import { ADMIN_ROUTES } from '@/lib/routes'
// Reading the timetable.
import { extractPages } from '@/lib/timetable/extractPdf'
import { parseTimetable } from '@/lib/timetable/parseTimetable'
import { buildPlan } from '@/lib/timetable/plan'
import type { PageProblem, PageText, TimetablePlan } from '@/lib/timetable/types'
// What an import did.
import type { ImportOutcome } from '@/types/programmes'

/** Reads a PDF's text and positions. The app uses pdf.js; a test supplies its own. */
type ReadPdf = (data: ArrayBuffer) => Promise<PageText[]>

/** Where the import is. */
type Step =
  | { kind: 'form'; error: { message: string; details: string[] } | null }
  | { kind: 'reading' }
  | { kind: 'review'; request: ImportRequest; plan: TimetablePlan; problems: PageProblem[] }
  | { kind: 'done'; outcome: ImportOutcome }

/** The page. `readPdf` is for tests. */
export function ImportTimetablePage({ readPdf = extractPages }: Readonly<{ readPdf?: ReadPdf }>) {
  // Which step is showing, and what the form held, so Back returns to it as it was.
  const [step, setStep] = useState<Step>({ kind: 'form', error: null })
  const [values, setValues] = useState<ImportFormValues>(EMPTY_IMPORT_VALUES)
  // The teachers the review offers.
  const options = useCourseFilterOptions()

  /** Reads the file and moves to the review, or back to the form with a reason. */
  async function read(request: ImportRequest, typed: ImportFormValues) {
    setValues(typed)
    setStep({ kind: 'reading' })
    try {
      const { pages, problems } = parseTimetable(await readPdf(await request.file.arrayBuffer()))
      if (pages.length === 0) {
        // Nothing to review: say which pages failed and why.
        setStep({
          kind: 'form',
          error: {
            message: 'No timetable page could be read from this file.',
            details: problems.map(
              (problem) => `Page ${String(problem.pageNumber)}: ${problem.message}`,
            ),
          },
        })
        return
      }
      setStep({ kind: 'review', request, plan: buildPlan(pages), problems })
    } catch (error) {
      setStep({ kind: 'form', error: { message: errorMessage(toAppError(error)), details: [] } })
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title="Import a timetable" />
      <div>
        <h1 className="text-2xl font-bold">Import a timetable</h1>
        <p className="text-sm text-muted-foreground">
          Create programmes, courses and classes from the school's timetable.{' '}
          <Link to={ADMIN_ROUTES.programmes} className="text-link underline">
            Back to programmes
          </Link>
        </p>
      </div>
      {step.kind === 'form' && (
        <ImportForm
          initial={values}
          busy={false}
          error={step.error}
          onSubmit={(request, typed) => {
            void read(request, typed)
          }}
        />
      )}
      {step.kind === 'reading' && (
        <output aria-label="Reading the timetable" className="block space-y-2">
          <p className="text-sm text-muted-foreground">Reading the timetable…</p>
          <Skeleton className="h-11 max-w-xl" />
        </output>
      )}
      {step.kind === 'review' &&
        (options.isPending ? (
          <output aria-label="Loading teachers" className="block">
            <Skeleton className="h-11 max-w-xl" />
          </output>
        ) : (
          <ImportReview
            plan={step.plan}
            problems={step.problems}
            term={step.request.term}
            timezone={step.request.timezone}
            teachers={options.data?.teachers ?? []}
            teachersFailed={options.isError}
            onBack={() => {
              setStep({ kind: 'form', error: null })
            }}
            onImported={(outcome) => {
              setStep({ kind: 'done', outcome })
            }}
          />
        ))}
      {step.kind === 'done' && (
        <ImportDone
          outcome={step.outcome}
          onAgain={() => {
            setValues(EMPTY_IMPORT_VALUES)
            setStep({ kind: 'form', error: null })
          }}
        />
      )}
    </div>
  )
}
