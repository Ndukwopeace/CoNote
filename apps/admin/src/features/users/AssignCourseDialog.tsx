/**
 * Gives a teacher a course from the Users screens (admin REQUIREMENTS section 12). A course has
 * one teacher, so choosing one that is already taught replaces its teacher.
 */

// The choice and the message about it.
import { useState } from 'react'

// Buttons, fields, messages and the toast.
import { Button } from '@conote/ui/button'
import { FormField } from '@conote/ui/forms/FormField'
import { FormMessage } from '@conote/ui/forms/FormMessage'
import { NativeSelect } from '@conote/ui/native-select'
import { useToast } from '@conote/ui/toast'

// The dialog around the form.
import { FormDialog } from '@/components/common/FormDialog'
// The change.
import { useAssignTeacher } from '@/hooks/useCourses'
// The courses to choose from.
import { useUserFilterOptions } from '@/hooks/useUsers'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'

/** Which teacher, and whether the dialog is open. */
interface AssignCourseDialogProps {
  teacher: { id: string; fullName: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The picker and its button. */
function AssignForm({
  teacher,
  onDone,
}: Readonly<{ teacher: AssignCourseDialogProps['teacher']; onDone: () => void }>) {
  // The courses in use, the change and the toast.
  const options = useUserFilterOptions()
  const assign = useAssignTeacher()
  const toast = useToast()
  // The chosen course's ID, and the message when none is chosen.
  const [courseId, setCourseId] = useState('')
  const [missing, setMissing] = useState(false)

  /** Saves the choice. */
  function save() {
    // A course must be chosen.
    if (!courseId) {
      setMissing(true)
      return
    }
    assign.mutate(
      { courseId, teacherId: teacher.id },
      {
        onSuccess: (course) => {
          toast.success(`${teacher.fullName} now teaches ${course.code}.`)
          onDone()
        },
      },
    )
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
      className="space-y-4"
    >
      {/* A failed change's message. */}
      {assign.error && <FormMessage tone="error">{errorMessage(assign.error)}</FormMessage>}
      <FormField id="assign-course" label="Course" error={missing ? 'Choose a course.' : undefined}>
        {(field) => (
          <NativeSelect
            {...field}
            value={courseId}
            onChange={(event) => {
              setCourseId(event.target.value)
              setMissing(false)
            }}
          >
            <option value="">Choose a course</option>
            {options.data?.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} {course.title}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" disabled={assign.isPending}>
          {assign.isPending ? 'Saving…' : 'Assign to course'}
        </Button>
      </div>
    </form>
  )
}

/** The assign dialog. */
export function AssignCourseDialog({
  teacher,
  open,
  onOpenChange,
}: Readonly<AssignCourseDialogProps>) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Assign ${teacher.fullName} to a course`}
      description="If the course already has a teacher, they are replaced."
    >
      {/* A fresh form each time it opens. */}
      {open && (
        <AssignForm
          teacher={teacher}
          onDone={() => {
            onOpenChange(false)
          }}
        />
      )}
    </FormDialog>
  )
}
