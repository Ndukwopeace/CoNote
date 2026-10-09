/**
 * The create and edit form for a class (admin REQUIREMENTS section 13). Editing loads the class's
 * details when the dialog opens, so it works from the list as well as the details page. A class
 * keeps its course, so the course is fixed when editing.
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
import { useClass, useClassFilterOptions, useCreateClass, useUpdateClass } from '@/hooks/useClasses'
// The form's rules, and the date and time conversions.
import { classSchema, type ClassValues } from '@/lib/classSchemas'
import { toDateInput, toTimeInput } from '@/lib/classTimes'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// Details shape.
import type { ClassDetails } from '@/types/classes'

/** Which class to edit (none to create), the course to start with, and whether it is open. */
interface ClassFormDialogProps {
  classId?: string
  // The course to preselect when creating, e.g. the list's course filter.
  defaultCourseId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The fields, filled with `item`'s values when editing. */
function ClassForm({
  item,
  defaultCourseId,
  onDone,
}: Readonly<{ item: ClassDetails | undefined; defaultCourseId: string; onDone: () => void }>) {
  // The saves, the choices and the toast.
  const create = useCreateClass()
  const update = useUpdateClass()
  const options = useClassFilterOptions()
  const toast = useToast()
  // Whichever save applies.
  const save = item ? update : create
  // Form state: the class's values, or a blank form.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClassValues>({
    resolver: zodResolver(classSchema),
    mode: 'onTouched',
    defaultValues: item
      ? {
          courseId: item.courseId,
          title: item.title,
          date: toDateInput(item.startsAt),
          startTime: toTimeInput(item.startsAt),
          endTime: toTimeInput(item.endsAt),
          description: item.description,
        }
      : {
          courseId: defaultCourseId,
          title: '',
          date: '',
          startTime: '',
          endTime: '',
          description: '',
        },
  })

  // New classes go to courses in use; an existing class shows its own course, whatever its state.
  const courses = (options.data?.courses ?? []).filter(
    (course) => item?.courseId === course.id || !course.archived,
  )

  /** Saves, confirms and closes. */
  function submit(values: ClassValues) {
    // The schema has already tidied the values; it runs again here to get its output type.
    const input = classSchema.parse(values)
    if (item) {
      update.mutate(
        { classId: item.id, input },
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
          toast.success(`Class “${created.title}” created.`)
          onDone()
        },
      })
    }
  }

  return (
    // noValidate: the zod rules give the messages, not the browser.
    <form noValidate onSubmit={(event) => void handleSubmit(submit)(event)} className="space-y-4">
      {/* A failed save's message. */}
      {save.error && <FormMessage tone="error">{errorMessage(save.error)}</FormMessage>}
      {/* The course: chosen when creating, fixed when editing (its number belongs to the course). */}
      <FormField id="class-course" label="Course" error={errors.courseId?.message}>
        {(field) =>
          item ? (
            <NativeSelect {...field} value={item.courseId} disabled onChange={() => undefined}>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} {course.title}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <NativeSelect {...field} {...register('courseId')}>
              <option value="">Choose a course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} {course.title}
                </option>
              ))}
            </NativeSelect>
          )
        }
      </FormField>
      <FormField id="class-title" label="Class title" error={errors.title?.message}>
        {(field) => <Input {...field} autoComplete="off" {...register('title')} />}
      </FormField>
      {/* Date and times, in the administrator's own time zone. */}
      <FormField id="class-date" label="Date" error={errors.date?.message}>
        {(field) => <Input {...field} type="date" {...register('date')} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="class-start" label="Start time" error={errors.startTime?.message}>
          {(field) => <Input {...field} type="time" {...register('startTime')} />}
        </FormField>
        <FormField id="class-end" label="End time" error={errors.endTime?.message}>
          {(field) => <Input {...field} type="time" {...register('endTime')} />}
        </FormField>
      </div>
      <FormField id="class-description" label="Description" error={errors.description?.message}>
        {(field) => <Textarea {...field} rows={3} {...register('description')} />}
      </FormField>
      {/* Save. */}
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : item ? 'Save changes' : 'Create class'}
        </Button>
      </div>
    </form>
  )
}

/** The create or edit dialog. */
export function ClassFormDialog({
  classId,
  defaultCourseId = '',
  open,
  onOpenChange,
}: Readonly<ClassFormDialogProps>) {
  // The details when editing (cached if the details page already loaded them).
  const { data } = useClass(classId ?? '')
  const editing = classId !== undefined

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${data?.title ?? 'class'}` : 'Create a class'}
      description={
        editing
          ? 'Change the title, time or description. The course can’t be changed.'
          : 'Add a class to a course. It is numbered after the course’s last class.'
      }
    >
      {/* The form once the details have loaded (or at once when creating); a block until then.
          A fresh form each time it opens, with the latest values. */}
      {editing && !data ? (
        <Skeleton className="h-64" />
      ) : (
        open && (
          <ClassForm
            key={`${classId ?? 'new'}-${String(open)}`}
            item={data}
            defaultCourseId={defaultCourseId}
            onDone={() => {
              onOpenChange(false)
            }}
          />
        )
      )}
    </FormDialog>
  )
}
