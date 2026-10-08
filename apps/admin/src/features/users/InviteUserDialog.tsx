/**
 * The invite form (admin REQUIREMENTS section 11): creates an invited (pending) account. In the
 * backend stage, an Edge Function also sends the invitation email.
 */

// Connects the zod rules to the form.
import { zodResolver } from '@hookform/resolvers/zod'
// Form state, and following the role field.
import { useForm, useWatch } from 'react-hook-form'

// The shared vocabulary.
import type { Role } from '@conote/domain'
// Buttons, fields, messages and the toast.
import { Button } from '@conote/ui/button'
import { FormField } from '@conote/ui/forms/FormField'
import { FormMessage } from '@conote/ui/forms/FormMessage'
import { Input } from '@conote/ui/input'
import { NativeSelect } from '@conote/ui/native-select'
import { useToast } from '@conote/ui/toast'

// The dialog around the form.
import { FormDialog } from '@/components/common/FormDialog'
// The invite, and the departments to choose from.
import { useInviteUser, useUserFilterOptions } from '@/hooks/useUsers'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// The form's rules.
import { inviteUserSchema, type InviteUserValues } from '@/lib/userSchemas'

/** Whether it is open, and the role to start with (the current tab's). */
interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: Role
}

/** The form. */
function InviteForm({ role, onDone }: Readonly<{ role: Role; onDone: () => void }>) {
  // The invite, the department choices and the toast.
  const invite = useInviteUser()
  const options = useUserFilterOptions()
  const toast = useToast()
  // Form state, starting with the tab's role.
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<InviteUserValues>({
    resolver: zodResolver(inviteUserSchema),
    mode: 'onTouched',
    defaultValues: { role, fullName: '', email: '', department: '' },
  })
  // Administrators have no department.
  const needsDepartment = useWatch({ control, name: 'role' }) !== 'admin'

  /** Sends the invitation, confirms and closes. */
  function send(values: InviteUserValues) {
    invite.mutate(values, {
      onSuccess: (user) => {
        toast.success(`Invitation sent to ${user.email}.`)
        onDone()
      },
    })
  }

  return (
    // noValidate: the zod rules give the messages, not the browser.
    <form noValidate onSubmit={(event) => void handleSubmit(send)(event)} className="space-y-4">
      {/* A failed invitation's message. A conflict here can only mean the email is taken. */}
      {invite.error && (
        <FormMessage tone="error">
          {invite.error.kind === 'conflict'
            ? 'An account with this email already exists.'
            : errorMessage(invite.error)}
        </FormMessage>
      )}
      {/* Role. */}
      <FormField id="invite-role" label="Role" error={errors.role?.message}>
        {(field) => (
          <NativeSelect {...field} {...register('role')}>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Administrator</option>
          </NativeSelect>
        )}
      </FormField>
      {/* Name and email. */}
      <FormField id="invite-name" label="Full name" error={errors.fullName?.message}>
        {(field) => <Input {...field} autoComplete="off" {...register('fullName')} />}
      </FormField>
      <FormField id="invite-email" label="Email" error={errors.email?.message}>
        {(field) => <Input {...field} type="email" autoComplete="off" {...register('email')} />}
      </FormField>
      {/* Department, for students and teachers. */}
      {needsDepartment && (
        <FormField id="invite-department" label="Department" error={errors.department?.message}>
          {(field) => (
            <NativeSelect {...field} {...register('department')}>
              <option value="">Choose a department</option>
              {options.data?.departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      )}
      {/* Send. */}
      <div className="flex justify-end">
        <Button type="submit" disabled={invite.isPending}>
          {invite.isPending ? 'Sending…' : 'Send invitation'}
        </Button>
      </div>
    </form>
  )
}

/** The invite dialog. */
export function InviteUserDialog({ open, onOpenChange, role }: Readonly<InviteUserDialogProps>) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invite a user"
      description="They'll get an email with a link to set their password. Until then, the account shows as Invited."
    >
      {/* A fresh form each time it opens. */}
      {open && (
        <InviteForm
          role={role}
          onDone={() => {
            onOpenChange(false)
          }}
        />
      )}
    </FormDialog>
  )
}
