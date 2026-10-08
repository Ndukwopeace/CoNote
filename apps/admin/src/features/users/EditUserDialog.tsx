/**
 * The form for changing someone's profile (admin REQUIREMENTS section 11). Loads the full
 * details when it opens, so it works from the list as well as from the details page.
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
import { Skeleton } from '@conote/ui/skeleton'
import { useToast } from '@conote/ui/toast'

// The dialog around the form.
import { FormDialog } from '@/components/common/FormDialog'
// The details and the save.
import { useUpdateUser, useUser } from '@/hooks/useUsers'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// The form's rules.
import { editUserSchema, type EditUserValues } from '@/lib/userSchemas'
// The details shape.
import type { UserDetails } from '@/types/users'

/** Which account, and whether the dialog is open. */
interface EditUserDialogProps {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The fields, filled with `user`'s current values. */
function EditForm({ user, onDone }: Readonly<{ user: UserDetails; onDone: () => void }>) {
  // The save, and the toast after it.
  const update = useUpdateUser()
  const toast = useToast()
  // Form state with the current values; blanks for missing ones.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    mode: 'onTouched',
    defaultValues: {
      fullName: user.fullName,
      department: user.department ?? '',
      level: user.level ?? '',
      phone: user.phone ?? '',
      studentNumber: user.studentNumber ?? '',
      staffNumber: user.staffNumber ?? '',
    },
  })

  /** Saves, confirms and closes. */
  function save(values: EditUserValues) {
    // The schema has already tidied the values; it runs again here to get its output type.
    const input = editUserSchema.parse(values)
    update.mutate(
      { userId: user.id, input },
      {
        onSuccess: () => {
          toast.success('Changes saved.')
          onDone()
        },
      },
    )
  }

  return (
    // noValidate: the zod rules give the messages, not the browser.
    <form noValidate onSubmit={(event) => void handleSubmit(save)(event)} className="space-y-4">
      {/* A failed save's message. */}
      {update.error && <FormMessage tone="error">{errorMessage(update.error)}</FormMessage>}
      {/* Name. */}
      <FormField id="edit-name" label="Full name" error={errors.fullName?.message}>
        {(field) => <Input {...field} autoComplete="off" {...register('fullName')} />}
      </FormField>
      {/* Department, for students and teachers. */}
      {user.role !== 'admin' && (
        <FormField id="edit-department" label="Department" error={errors.department?.message}>
          {(field) => <Input {...field} {...register('department')} />}
        </FormField>
      )}
      {/* Student fields. */}
      {user.role === 'student' && (
        <>
          <FormField id="edit-number" label="Student number" error={errors.studentNumber?.message}>
            {(field) => <Input {...field} {...register('studentNumber')} />}
          </FormField>
          <FormField id="edit-level" label="Level" error={errors.level?.message}>
            {(field) => <Input {...field} placeholder="e.g. 200 Level" {...register('level')} />}
          </FormField>
        </>
      )}
      {/* Teacher field. */}
      {user.role === 'teacher' && (
        <FormField id="edit-staff" label="Staff number" error={errors.staffNumber?.message}>
          {(field) => <Input {...field} {...register('staffNumber')} />}
        </FormField>
      )}
      {/* Phone. */}
      <FormField id="edit-phone" label="Phone" error={errors.phone?.message}>
        {(field) => <Input {...field} type="tel" autoComplete="off" {...register('phone')} />}
      </FormField>
      {/* Save. */}
      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

/** The edit dialog. */
export function EditUserDialog({ userId, open, onOpenChange }: Readonly<EditUserDialogProps>) {
  // The full details (cached if the details page already loaded them).
  const { data } = useUser(userId)

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={data ? `Edit ${data.fullName}` : 'Edit user'}
      description="Change the profile details. The email address can't be changed here."
    >
      {/* The form once the details have loaded; a block until then. A fresh form each time
          it opens, with the latest values. */}
      {data ? (
        <EditForm
          key={`${data.id}-${String(open)}`}
          user={data}
          onDone={() => {
            onOpenChange(false)
          }}
        />
      ) : (
        <Skeleton className="h-64" />
      )}
    </FormDialog>
  )
}
