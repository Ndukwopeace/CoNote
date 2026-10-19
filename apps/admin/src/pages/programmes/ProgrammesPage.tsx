/**
 * Programmes (D105): the courses students take together, such as Software Engineering Year 1.
 * A student picks one when they sign up and is enrolled in all its courses. They are created by
 * importing the school's timetable.
 */

// The import icon.
import { Upload } from 'lucide-react'
// Links inside the app.
import { Link } from 'react-router'

// The link styled as a button, and the tab title.
import { buttonVariants } from '@conote/ui/button'
import { PageTitle } from '@conote/ui/common/PageTitle'

// The list.
import { ProgrammeList } from '@/features/programmes/ProgrammeList'
// The address of the import.
import { ADMIN_ROUTES } from '@/lib/routes'

/** Programmes. */
export function ProgrammesPage() {
  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title="Programmes" />
      {/* Heading and the way to the import. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Programmes</h1>
          <p className="text-sm text-muted-foreground">
            A student picks a programme when they sign up and joins all its courses at once.
          </p>
        </div>
        <Link to={ADMIN_ROUTES.importTimetable} className={buttonVariants()}>
          <Upload aria-hidden="true" />
          Import timetable
        </Link>
      </div>
      {/* The list. */}
      <ProgrammeList />
    </div>
  )
}
