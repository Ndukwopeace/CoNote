/**
 * The last step of the timetable import (D105): what was created, and where to look at it.
 */

// Links inside the app.
import { Link } from 'react-router'

// Buttons.
import { Button, buttonVariants } from '@conote/ui/button'

// Counts in words.
import { countOf } from '@/lib/timetable/describe'
// Addresses.
import { ADMIN_ROUTES } from '@/lib/routes'
// What an import did.
import type { ImportOutcome } from '@/types/programmes'

/** What the step shows. */
interface ImportDoneProps {
  outcome: ImportOutcome
  // Starts another import.
  onAgain: () => void
}

/** The step. */
export function ImportDone({ outcome, onAgain }: Readonly<ImportDoneProps>) {
  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-xl font-semibold">Timetable imported</h2>
      <p>
        {countOf(outcome.coursesCreated, 'course')} and{' '}
        {countOf(outcome.classesCreated, 'class', 'classes')} were created.
      </p>
      <ul className="list-disc pl-5 text-sm text-muted-foreground">
        <li>
          {countOf(outcome.programmesCreated, 'programme')} created, {outcome.programmesExisting}{' '}
          already existed.
        </li>
        <li>
          {countOf(outcome.coursesExisting, 'course')} already existed and kept their details.
        </li>
        <li>
          {countOf(outcome.classesSkipped, 'class', 'classes')} already existed and were left as
          they are.
        </li>
        <li>{countOf(outcome.teachersAssigned, 'teacher')} assigned to courses.</li>
      </ul>
      <div className="flex flex-wrap gap-3">
        <Link to={ADMIN_ROUTES.programmes} className={buttonVariants()}>
          View programmes
        </Link>
        <Link to={ADMIN_ROUTES.courses} className={buttonVariants({ variant: 'outline' })}>
          View courses
        </Link>
        <Button type="button" variant="outline" onClick={onAgain}>
          Import another
        </Button>
      </div>
    </div>
  )
}
