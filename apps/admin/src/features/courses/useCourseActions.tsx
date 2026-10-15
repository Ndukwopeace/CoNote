/**
 * What an administrator can do to one course (admin REQUIREMENTS section 12): edit it, archive it
 * (asking first), restore it and delete an archived one (after typing its code). Shared by the list's row menu and the details page's buttons, so
 * both behave the same.
 */

// Dialog and confirmation state.
import { useState } from 'react'

// The confirmation dialog.
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
// The confirmation that asks for the code to be typed.
import { TypeToConfirmDialog } from '@conote/ui/common/TypeToConfirmDialog'
// Toasts.
import { useToast } from '@conote/ui/toast'

// The changes.
import { useArchiveCourse, useDeleteCourse, useRestoreCourse } from '@/hooks/useCourses'
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

/** What a screen can add to the actions. */
interface CourseActionOptions {
  // Called once the course is deleted, so a page about that course can leave.
  onDeleted?: () => void
}

/** The actions for `course`, and the dialogs they open (render `dialogs` once). */
export function useCourseActions(course: ActionCourse, { onDeleted }: CourseActionOptions = {}) {
  // The two changes and the toasts that report them.
  const archive = useArchiveCourse()
  const restore = useRestoreCourse()
  const remove = useDeleteCourse()
  const toast = useToast()
  // Whether the archive question or the edit form is open.
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
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
    // Asks for the code to be typed before deleting; only an archived course can be.
    askDelete: () => {
      setConfirmingDelete(true)
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
        {confirmingDelete && (
          <TypeToConfirmDialog
            open
            onOpenChange={setConfirmingDelete}
            title={`Delete ${course.code} for good?`}
            description="Its classes, summaries, students' notes, resources and enrolments are removed and can't be brought back."
            expected={course.code}
            confirmLabel="Delete course"
            onConfirm={() => {
              remove.mutate(course.id, {
                onSuccess: () => {
                  toast.success(`${course.code} was deleted.`)
                  onDeleted?.()
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
