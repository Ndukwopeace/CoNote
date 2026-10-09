/**
 * Assigns or changes a course's teacher (admin REQUIREMENTS section 12). The picker lists only
 * active teachers; the service checks the same rule.
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
// The choices and the change.
import { useAssignTeacher, useCourseFilterOptions } from '@/hooks/useCourses'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// The course shape.
import type { CourseDetails } from '@/types/courses'

/** Which course, and whether the dialog is open. */
interface TeacherDialogProps {
  course: CourseDetails
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The picker and its button. */
function TeacherForm({ course, onDone }: Readonly<{ course: CourseDetails; onDone: () => void }>) {
  // The teachers to choose from, the change and the toast.
  const options = useCourseFilterOptions()
  const assign = useAssignTeacher()
  const toast = useToast()
  // The chosen teacher's ID, and the message when none is chosen.
  const [teacherId, setTeacherId] = useState(course.teacher?.id ?? '')
  const [missing, setMissing] = useState(false)

  /** Saves the choice. */
  function save() {
    // A teacher must be chosen.
    if (!teacherId) {
      setMissing(true)
      return
    }
    assign.mutate(
      { courseId: course.id, teacherId },
      {
        onSuccess: (updated) => {
          toast.success(`${updated.teacher?.fullName ?? 'The teacher'} now teaches ${course.code}.`)
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
      <FormField
        id="assign-teacher"
        label="Teacher"
        error={missing ? 'Choose a teacher.' : undefined}
      >
        {(field) => (
          <NativeSelect
            {...field}
            value={teacherId}
            onChange={(event) => {
              setTeacherId(event.target.value)
              setMissing(false)
            }}
          >
            <option value="">Choose a teacher</option>
            {options.data?.teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" disabled={assign.isPending}>
          {assign.isPending ? 'Saving…' : course.teacher ? 'Save teacher' : 'Assign teacher'}
        </Button>
      </div>
    </form>
  )
}

/** The assign or change dialog. */
export function TeacherDialog({ course, open, onOpenChange }: Readonly<TeacherDialogProps>) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={course.teacher ? 'Change the teacher' : 'Assign a teacher'}
      description={`Only active teachers can teach ${course.code}.`}
    >
      {/* A fresh form each time it opens. */}
      {open && (
        <TeacherForm
          course={course}
          onDone={() => {
            onOpenChange(false)
          }}
        />
      )}
    </FormDialog>
  )
}
