/**
 * The create and edit form for a course (admin REQUIREMENTS section 12). Editing loads the
 * course's details when the dialog opens, so it works from the list as well as the details page.
 */

// Connects the zod rules to the form.
import { zodResolver } from '@hookform/resolvers/zod'
// Form state.
import { useForm } from 'react-hook-form'

// Buttons, fields, messages and the toast.
import { Button } from '@conote/ui/button'
import { FormField } from '@conote/ui/forms/FormField'
import { FormMessage } from '@conote/ui/forms/FormMessage'
import { Input } from '@conote/ui/input'
import { NativeSelect } from '@conote/ui/native-select'
import { Skeleton } from '@conote/ui/skeleton'
import { Textarea } from '@conote/ui/textarea'
import { useToast } from '@conote/ui/toast'

// The dialog around the form.
import { FormDialog } from '@/components/common/FormDialog'
// The details, the choices and the saves.
import {
  useCourse,
  useCourseFilterOptions,
  useCreateCourse,
  useUpdateCourse,
} from '@/hooks/useCourses'
// The form's rules.
import { courseSchema, type CourseValues } from '@/lib/courseSchemas'
// Status wording.
import { COURSE_STATUSES, courseStatusLabel } from '@/lib/courseStatus'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// Details shape.
import type { CourseDetails } from '@/types/courses'

/** Which course to edit (none to create), and whether the dialog is open. */
interface CourseFormDialogProps {
  courseId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The blank form for a new course. */
const BLANK: CourseValues = {
  code: '',
  title: '',
  description: '',
  department: '',
  status: 'upcoming',
  teacherId: '',
}

/** The fields, filled with `course`'s values when editing. */
function CourseForm({
  course,
  onDone,
}: Readonly<{ course: CourseDetails | undefined; onDone: () => void }>) {
  // The saves, the choices and the toast.
  const create = useCreateCourse()
  const update = useUpdateCourse()
  const options = useCourseFilterOptions()
  const toast = useToast()
  // Whichever save applies.
  const save = course ? update : create
  // Form state: the course's values, or a blank form.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CourseValues>({
    resolver: zodResolver(courseSchema),
    mode: 'onTouched',
    defaultValues: course
      ? {
          code: course.code,
          title: course.title,
          description: course.description,
          department: course.department ?? '',
          status: course.status,
          teacherId: course.teacher?.id ?? '',
        }
      : BLANK,
  })

  // The teachers to choose from: the active ones, plus the current one if no longer active, so
  // the form doesn't silently show "no teacher".
  const teachers = options.data?.teachers ?? []
  const current = course?.teacher
  const showCurrent = current && !teachers.some((teacher) => teacher.id === current.id)

  /** Saves, confirms and closes. */
  function submit(values: CourseValues) {
    // The schema has already tidied the values; it runs again here to get its output type.
    const input = courseSchema.parse(values)
    if (course) {
      update.mutate(
        { courseId: course.id, input },
        {
          onSuccess: () => {
            toast.success('Changes saved.')
            onDone()
          },
        },
      )
    } else {
      create.mutate(input, {
        onSuccess: (created) => {
          toast.success(`Course ${created.code} created.`)
          onDone()
        },
      })
    }
  }

  return (
    // noValidate: the zod rules give the messages, not the browser.
    <form noValidate onSubmit={(event) => void handleSubmit(submit)(event)} className="space-y-4">
      {/* A failed save's message. A conflict here can only mean the code is taken. */}
      {save.error && (
        <FormMessage tone="error">
          {save.error.kind === 'conflict'
            ? 'A course with this code already exists.'
            : errorMessage(save.error)}
        </FormMessage>
      )}
      {/* Code and title. */}
      <FormField id="course-code" label="Course code" error={errors.code?.message}>
        {(field) => (
          <Input {...field} placeholder="e.g. SWE 311" autoComplete="off" {...register('code')} />
        )}
      </FormField>
      <FormField id="course-title" label="Title" error={errors.title?.message}>
        {(field) => <Input {...field} autoComplete="off" {...register('title')} />}
      </FormField>
      <FormField id="course-description" label="Description" error={errors.description?.message}>
        {(field) => <Textarea {...field} rows={3} {...register('description')} />}
      </FormField>
      {/* Department: any text, with the departments in use suggested. */}
      <FormField id="course-department" label="Department" error={errors.department?.message}>
        {(field) => (
          <>
            <Input {...field} list="course-departments" {...register('department')} />
            <datalist id="course-departments">
              {options.data?.departments.map((department) => (
                <option key={department} value={department} />
              ))}
            </datalist>
          </>
        )}
      </FormField>
      {/* Teacher: only active teachers. */}
      <FormField id="course-teacher" label="Teacher" error={errors.teacherId?.message}>
        {(field) => (
          <NativeSelect {...field} {...register('teacherId')}>
            <option value="">No teacher yet</option>
            {showCurrent && <option value={current.id}>{current.fullName} (not active)</option>}
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField id="course-status" label="Status" error={errors.status?.message}>
        {(field) => (
          <NativeSelect {...field} {...register('status')}>
            {COURSE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {courseStatusLabel(status)}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      {/* Save. */}
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : course ? 'Save changes' : 'Create course'}
        </Button>
      </div>
    </form>
  )
}

/** The create or edit dialog. */
export function CourseFormDialog({
  courseId,
  open,
  onOpenChange,
}: Readonly<CourseFormDialogProps>) {
  // The details when editing (cached if the details page already loaded them).
  const { data } = useCourse(courseId ?? '')
  const editing = courseId !== undefined

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${data?.code ?? 'course'}` : 'Create a course'}
      description={
        editing
          ? 'Change the course’s details or its teacher.'
          : 'Add a course. The code must be new; you can assign a teacher now or later.'
      }
    >
      {/* The form once the details have loaded (or at once when creating); a block until then.
          A fresh form each time it opens, with the latest values. */}
      {editing && !data ? (
        <Skeleton className="h-64" />
      ) : (
        open && (
          <CourseForm
            key={`${courseId ?? 'new'}-${String(open)}`}
            course={data}
            onDone={() => {
              onOpenChange(false)
            }}
          />
        )
      )}
    </FormDialog>
  )
}
