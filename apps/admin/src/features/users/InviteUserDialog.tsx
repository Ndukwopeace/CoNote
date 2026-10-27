/**
 * The invite form (admin REQUIREMENTS section 11): creates an invited (pending) account. In the
 * backend stage, an Edge Function also sends the invitation email.
 */

// Connects the zod rules to the form.
import { zodResolver } from '@hookform/resolvers/zod'
// Form state, and the courses picked for a teacher.
import { useState } from 'react'
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
// The courses a new teacher will teach (D116).
import { InvitedCoursesField } from './InvitedCoursesField'
// The invite.
import { useInviteUser } from '@/hooks/useUsers'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// "A, B and C".
import { joinWords } from '@/lib/format'
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
  // The invite and the toast.
  const invite = useInviteUser()
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
    defaultValues: { role, fullName: '', email: '' },
  })
  // The courses ticked for a teacher. They live here, not in the form's values, so changing the
  // role away from teacher and back does not lose them, and only a teacher's are ever sent.
  const [courseIds, setCourseIds] = useState<string[]>([])
  // Whether a teacher is being invited, which is when courses are offered.
  const isTeacher = useWatch({ control, name: 'role' }) === 'teacher'

  /** Sends the invitation, confirms (naming the courses, if any) and closes. */
  function send(values: InviteUserValues) {
    // SECURITY: courses go only with a teacher, whatever was ticked before the role changed.
    const chosen = values.role === 'teacher' ? courseIds : []
    invite.mutate(chosen.length > 0 ? { ...values, courseIds: chosen } : values, {
      onSuccess: (user) => {
        // The courses the service kept, so the words match what will happen.
        const codes = user.invitedCourses.map((course) => course.code)
        toast.success(
          codes.length > 0
            ? `Invitation sent to ${user.email}. ${joinWords(codes)} will be theirs when they first sign in.`
            : `Invitation sent to ${user.email}.`,
        )
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
      {/* The courses a new teacher will teach, in the same step (D116). */}
      {isTeacher && <InvitedCoursesField selected={courseIds} onChange={setCourseIds} />}
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
      description="They'll get an email to get started. Teachers and administrators sign in with an emailed code and choose a password the first time; students follow the link in the email. Until then, the account shows as Invited."
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
