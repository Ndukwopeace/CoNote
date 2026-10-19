/**
 * The Programmes table with its loading, empty and error states (D105): each programme's courses
 * and students, whether students may join it themselves, and the button that opens or closes it.
 */

// Icon for the empty state.
import { GraduationCap } from 'lucide-react'
// Whether a row's students dialog is showing.
import { useState } from 'react'
// Links inside the app.
import { Link } from 'react-router'

// Buttons, the badge, empty states and loading blocks.
import { Badge } from '@conote/ui/badge'
import { Button, buttonVariants } from '@conote/ui/button'
import { EmptyState } from '@conote/ui/common/EmptyState'
import { Skeleton } from '@conote/ui/skeleton'
// Toasts.
import { useToast } from '@conote/ui/toast'

// The load-failure panel.
import { ErrorState } from '@conote/portal'
// The table.
import { DataTable, type DataColumn } from '@/components/common/DataTable'
// The students dialog.
import { ProgrammeMembersDialog } from './ProgrammeMembersDialog'
// The data and the change.
import { useProgrammes, useSetEnrolmentOpen } from '@/hooks/useProgrammes'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// The address of the import.
import { ADMIN_ROUTES } from '@/lib/routes'
// The row shape.
import type { ProgrammeListItem } from '@/types/programmes'

/** The columns: the programme, its figures and its state. */
const COLUMNS: DataColumn<ProgrammeListItem, never>[] = [
  {
    heading: 'Programme',
    cell: (programme) => (
      <span className="min-w-0">
        <span className="block font-medium">{programme.name}</span>
        <span className="block text-xs text-muted-foreground">{programme.code}</span>
      </span>
    ),
  },
  { heading: 'Courses', cell: (programme) => String(programme.courseCount) },
  { heading: 'Students', cell: (programme) => String(programme.studentCount) },
  { heading: 'Requests', cell: (programme) => String(programme.pendingRequestCount) },
  {
    heading: 'Enrolment',
    // The word is always shown, so colour is never the only signal.
    cell: (programme) => (
      <Badge variant={programme.openEnrolment ? 'success' : 'outline'}>
        {programme.openEnrolment ? 'Open' : 'Closed'}
      </Badge>
    ),
  },
]

/** The button that opens or closes one programme, and says so. */
function EnrolmentToggle({ programme }: Readonly<{ programme: ProgrammeListItem }>) {
  // The change, and the toasts that report it.
  const change = useSetEnrolmentOpen()
  const toast = useToast()

  /** Opens or closes `programme` to students joining it themselves, and says so. */
  function toggle() {
    const open = !programme.openEnrolment
    change.mutate(
      { programmeId: programme.id, open },
      {
        onSuccess: () => {
          toast.success(
            `${programme.code} is ${open ? 'open' : 'closed'} to students joining it themselves.`,
          )
        },
        onError: (error) => {
          toast.error(errorMessage(error))
        },
      },
    )
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={change.isPending} onClick={toggle}>
      {programme.openEnrolment ? 'Close enrolment' : 'Open enrolment'}
    </Button>
  )
}

/** One programme's row actions: its students, and opening or closing it. */
function RowActions({ programme }: Readonly<{ programme: ProgrammeListItem }>) {
  // Whether the students dialog is showing.
  const [showing, setShowing] = useState(false)
  return (
    <span className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Students in ${programme.code}`}
        onClick={() => {
          setShowing(true)
        }}
      >
        Students
      </Button>
      <EnrolmentToggle programme={programme} />
      <ProgrammeMembersDialog
        programme={showing ? programme : null}
        onClose={() => {
          setShowing(false)
        }}
      />
    </span>
  )
}

/** The row actions for one programme, defined once outside the component. */
function renderActions(programme: ProgrammeListItem) {
  return <RowActions programme={programme} />
}

/** The list. */
export function ProgrammeList() {
  // The programmes, the change, and the toasts that report it.
  const { data, isPending, isError, refetch } = useProgrammes()

  // Failed: the message and a retry.
  if (isError) return <ErrorState thing="programmes" onRetry={() => void refetch()} />
  // First load: rows of blocks, announced once.
  if (isPending) {
    return (
      <output aria-label="Loading programmes" className="block space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-11" />
        ))}
      </output>
    )
  }
  // No programme yet: how to get some.
  if (data.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No programmes yet."
        action={
          <Link to={ADMIN_ROUTES.importTimetable} className={buttonVariants()}>
            Import a timetable
          </Link>
        }
      />
    )
  }
  return (
    <DataTable
      label="Programmes"
      rows={data}
      rowKey={(programme) => programme.id}
      columns={COLUMNS}
      actions={renderActions}
    />
  )
}
