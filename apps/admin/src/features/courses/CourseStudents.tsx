/**
 * The Students tab (admin REQUIREMENTS section 12): the enrolled list with search, removal after
 * confirmation, and the enrol dialog.
 */

// The enrol icon.
import { UserPlus } from 'lucide-react'
// Search and dialog state.
import { useState } from 'react'

// Buttons, the confirmation, loading blocks and the toast.
import { Button } from '@conote/ui/button'
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
import { Skeleton } from '@conote/ui/skeleton'
import { useToast } from '@conote/ui/toast'

// The shared table, load-failure panel and search box.
import { DataTable, type DataColumn } from '@/components/common/DataTable'
import { ErrorState } from '@/components/common/ErrorState'
import { SearchField } from '@/components/common/SearchField'
// The student's account status.
import { UserStatusBadge } from '@/components/users/UserStatusBadge'
// The list and the removal.
import { useCourseStudents, useRemoveStudent } from '@/hooks/useCourses'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// Student shape.
import type { EnrolledStudent } from '@/types/courses'

// The bulk enrol form.
import { EnrolStudentsDialog } from './EnrolStudentsDialog'

/** Which course, and whether it can change. */
interface CourseStudentsProps {
  courseId: string
  code: string
  // True for an archived course: the list shows, but nothing can change.
  locked: boolean
}

/** The Students tab. */
export function CourseStudents({ courseId, code, locked }: Readonly<CourseStudentsProps>) {
  // The search, the list, the removal and the toast.
  const [q, setQ] = useState('')
  const { data, isPending, isError, refetch } = useCourseStudents(courseId, q)
  const remove = useRemoveStudent()
  const toast = useToast()
  // Whether the enrol form is open, and who is waiting to be removed.
  const [enrolling, setEnrolling] = useState(false)
  const [removing, setRemoving] = useState<EnrolledStudent | null>(null)

  // The columns; removal is the row action.
  const columns: DataColumn<EnrolledStudent, never>[] = [
    { heading: 'Name', cell: (student) => <span className="font-medium">{student.fullName}</span> },
    { heading: 'Email', cell: (student) => student.email },
    { heading: 'Student number', cell: (student) => student.studentNumber ?? '—' },
    { heading: 'Status', cell: (student) => <UserStatusBadge status={student.status} /> },
  ]

  /** The table, or the state in its place. */
  function body() {
    if (isError) return <ErrorState thing="students" onRetry={() => void refetch()} />
    if (isPending) {
      return (
        <output aria-label="Loading students" className="block space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-11" />
          ))}
        </output>
      )
    }
    // Nobody found: the search, or nobody enrolled at all.
    if (data.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          {q ? 'No students match this search.' : 'No students are enrolled yet.'}
        </p>
      )
    }
    return (
      <DataTable
        label={`Students in ${code}`}
        rows={data}
        rowKey={(student) => student.id}
        columns={columns}
        actions={
          locked
            ? undefined
            : (student) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${student.fullName}`}
                  onClick={() => {
                    setRemoving(student)
                  }}
                >
                  Remove
                </Button>
              )
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and the enrol button. */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          label="Search students"
          placeholder="Search by name, email or number"
          value={q || undefined}
          onSearch={(query) => {
            setQ(query ?? '')
          }}
        />
        {!locked && (
          <Button
            type="button"
            onClick={() => {
              setEnrolling(true)
            }}
          >
            <UserPlus aria-hidden="true" />
            Enrol students
          </Button>
        )}
      </div>
      {body()}
      {/* The dialogs, mounted only while open. */}
      {enrolling && (
        <EnrolStudentsDialog courseId={courseId} code={code} open onOpenChange={setEnrolling} />
      )}
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setRemoving(null)
          }}
          title={`Remove ${removing.fullName}?`}
          description={`They’ll no longer be in ${code}. Their own notes are kept.`}
          confirmLabel="Remove"
          onConfirm={() => {
            remove.mutate(
              { courseId, studentId: removing.id },
              {
                onSuccess: () => {
                  toast.success(`${removing.fullName} removed from ${code}.`)
                },
                onError: (error) => {
                  toast.error(errorMessage(error))
                },
              },
            )
          }}
        />
      )}
    </div>
  )
}
