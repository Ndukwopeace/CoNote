/**
 * What an administrator can do to one course (admin REQUIREMENTS section 12): edit it, archive it
 * (asking first) and restore it. Shared by the list's row menu and the details page's buttons, so
 * both behave the same.
 */

// Dialog and confirmation state.
import { useState } from 'react'

// The confirmation dialog.
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
// Toasts.
import { useToast } from '@conote/ui/toast'

// The changes.
import { useArchiveCourse, useRestoreCourse } from '@/hooks/useCourses'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'

// The edit form.
import { CourseFormDialog } from './CourseFormDialog'

/** The part of a course the actions need. */
interface ActionCourse {
  id: string
  code: string
  // When it was archived, or null while it is in use.
  archivedAt: string | null
}

/** The actions for `course`, and the dialogs they open (render `dialogs` once). */
export function useCourseActions(course: ActionCourse) {
  // The two changes and the toasts that report them.
  const archive = useArchiveCourse()
  const restore = useRestoreCourse()
  const toast = useToast()
  // Whether the archive question or the edit form is open.
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [editing, setEditing] = useState(false)

  return {
    // An archived course can't be edited or archived again.
    isArchived: course.archivedAt !== null,
    // Opens the edit form.
    edit: () => {
      setEditing(true)
    },
    // Asks before archiving.
    askArchive: () => {
      setConfirmingArchive(true)
    },
    // Puts an archived course back in use, and says so.
    restore: () => {
      restore.mutate(course.id, {
        onSuccess: () => {
          toast.success(`${course.code} restored.`)
        },
        onError: (error) => {
          toast.error(errorMessage(error))
        },
      })
    },
    // The question and the edit form, mounted only while open, so a list of rows doesn't load
    // every course's details or build a dialog per row.
    dialogs: (
      <>
        {confirmingArchive && (
          <ConfirmDialog
            open
            onOpenChange={setConfirmingArchive}
            title={`Archive ${course.code}?`}
            description="It leaves the course lists and can't be changed until it is restored. Its classes, students and notes are kept."
            confirmLabel="Archive"
            onConfirm={() => {
              archive.mutate(course.id, {
                onSuccess: () => {
                  toast.success(`${course.code} archived.`)
                },
                onError: (error) => {
                  toast.error(errorMessage(error))
                },
              })
            }}
          />
        )}
        {editing && <CourseFormDialog courseId={course.id} open onOpenChange={setEditing} />}
      </>
    ),
  }
}
