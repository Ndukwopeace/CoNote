/**
 * The Overview tab (admin REQUIREMENTS section 12): description, teacher, and the counts, with
 * the teacher controls. Removing a teacher leaves the course unassigned, which raises the
 * dashboard's "course without a teacher" alert.
 */

// Dialog and confirmation state.
import { useState } from 'react'

// Buttons, the confirmation and the toast.
import { Button } from '@conote/ui/button'
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
import { useToast } from '@conote/ui/toast'

// The status label.
import { CourseStatusBadge } from '@/components/courses/CourseStatusBadge'
// The change.
import { useRemoveTeacher } from '@/hooks/useCourses'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// Dates.
import { formatDate } from '@/lib/format'
// The course shape.
import type { CourseDetails } from '@/types/courses'

// The assign and change form.
import { TeacherDialog } from './TeacherDialog'

/** The Overview tab. */
export function CourseOverview({ course }: Readonly<{ course: CourseDetails }>) {
  // The removal, the toast, and which dialog is open.
  const remove = useRemoveTeacher()
  const toast = useToast()
  const [picking, setPicking] = useState(false)
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)
  // An archived course can't change.
  const locked = course.archivedAt !== null

  // The facts, as terms and values.
  const rows: [string, string | number][] = [
    ['Department', course.department ?? '—'],
    ['Students', course.studentCount],
    ['Classes', course.classCount],
    ['Published summaries', course.publishedSummaryCount],
    ['Resources', course.resources.length],
    ['Created', formatDate(course.createdAt)],
  ]

  return (
    <div className="space-y-6">
      {/* Description. */}
      <section>
        <h2 className="mb-1 font-semibold">Description</h2>
        <p className="text-sm whitespace-pre-line">
          {course.description || <span className="text-muted-foreground">No description yet.</span>}
        </p>
      </section>
      {/* Status and teacher, with the teacher controls. */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="mb-1 font-semibold">Status</h2>
          <CourseStatusBadge status={course.status} archivedAt={course.archivedAt} />
        </div>
        <div>
          <h2 className="mb-1 font-semibold">Teacher</h2>
          {course.teacher ? (
            <p className="text-sm font-medium">{course.teacher.fullName}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No teacher assigned.</p>
          )}
          {!locked && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPicking(true)
                }}
              >
                {course.teacher ? 'Change teacher' : 'Assign teacher'}
              </Button>
              {course.teacher && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setConfirmingRemoval(true)
                  }}
                >
                  Remove teacher
                </Button>
              )}
            </div>
          )}
        </div>
      </section>
      {/* The counts. */}
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {/* The dialogs, mounted only while open. */}
      {picking && <TeacherDialog course={course} open onOpenChange={setPicking} />}
      {confirmingRemoval && course.teacher && (
        <ConfirmDialog
          open
          onOpenChange={setConfirmingRemoval}
          title={`Remove ${course.teacher.fullName}?`}
          description={`${course.code} will have no teacher until you assign one, and will show in the dashboard’s “course without a teacher” alert.`}
          confirmLabel="Remove"
          onConfirm={() => {
            remove.mutate(course.id, {
              onSuccess: () => {
                toast.success(`Teacher removed from ${course.code}.`)
              },
              onError: (error) => {
                toast.error(errorMessage(error))
              },
            })
          }}
        />
      )}
    </div>
  )
}
