/**
 * Settings → Account (FR-SET-2): change password, the Google sign-in method, sign out, and
 * "Request account deletion".
 */

// Connects the password rules to the form.
import { zodResolver } from '@hookform/resolvers/zod'
// Icons.
import { LogOut, Trash2 } from 'lucide-react'
// Dialog and error state.
import { useState } from 'react'
// Form state.
import { useForm } from 'react-hook-form'

// Yes/no dialog.
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
// Labelled field, the error box and the password input.
import { FormField } from '@/components/forms/FormField'
import { FormMessage } from '@/components/forms/FormMessage'
import { PasswordInput } from '@/components/forms/PasswordInput'
// Standard button.
import { Button } from '@/components/ui/button'
// Sign-in state and actions.
import { useAuth } from '@/features/auth/useAuth'
// Toast messages.
import { useToast } from '@/features/toast/useToast'
// Password rules.
import { changePasswordSchema, type ChangePasswordValues } from '@/lib/authSchemas'
// Student-facing wording for errors.
import { errorMessage } from '@/lib/errorMessages'
// Normalises anything thrown.
import { toAppError } from '@/lib/errors'

// The section card.
import { SettingsSection } from './SettingsSection'

/** Empty starting values, so every field is controlled. */
const EMPTY: ChangePasswordValues = { currentPassword: '', password: '', confirmPassword: '' }

/** The Account tab. */
export function AccountTab() {
  // Sign-in state and actions.
  const auth = useAuth()
  // Toasts.
  const toast = useToast()
  // Whether the deletion dialog is open.
  const [confirmDelete, setConfirmDelete] = useState(false)
  // The service's refusal of a password change.
  const [serverError, setServerError] = useState<string | null>(null)
  // The password form.
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onTouched',
    defaultValues: EMPTY,
  })
  // The account email, for the sign-in method row.
  const email = auth.status === 'signedIn' ? auth.session.user.email : ''

  /** Changes the password, then clears the fields. */
  async function changePassword({ currentPassword, password }: ChangePasswordValues) {
    setServerError(null)
    try {
      await auth.updatePassword(currentPassword, password)
      // SECURITY: the passwords leave the page's memory straight away.
      reset(EMPTY)
      toast.success('Password changed.')
    } catch (error) {
      setServerError(errorMessage(toAppError(error)))
    }
  }

  return (
    <div className="space-y-6">
      {/* Change password. */}
      <SettingsSection
        title="Change password"
        description="Use at least 8 characters with a letter and a number."
      >
        <form
          noValidate
          onSubmit={(event) => void handleSubmit(changePassword)(event)}
          className="space-y-4"
        >
          {serverError && <FormMessage tone="error">{serverError}</FormMessage>}
          <FormField
            id="current-password"
            label="Current password"
            error={errors.currentPassword?.message}
          >
            {(field) => (
              <PasswordInput
                {...field}
                autoComplete="current-password"
                {...register('currentPassword')}
              />
            )}
          </FormField>
          <FormField id="new-password" label="New password" error={errors.password?.message}>
            {(field) => (
              <PasswordInput {...field} autoComplete="new-password" {...register('password')} />
            )}
          </FormField>
          <FormField
            id="confirm-new-password"
            label="Confirm new password"
            error={errors.confirmPassword?.message}
          >
            {(field) => (
              <PasswordInput
                {...field}
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
            )}
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Changing…' : 'Change password'}
            </Button>
          </div>
        </form>
      </SettingsSection>

      {/* Sign-in method (D38: Google only). */}
      <SettingsSection title="Sign-in method">
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <p className="font-medium">Google</p>
            <p className="text-sm text-muted-foreground">
              Sign in with the Google account for {email}.
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* Sign out, and account deletion. */}
      <SettingsSection title="Session and account">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              // The guard moves the student to the landing page (see RequireStudent).
              void auth.signOut()
            }}
          >
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setConfirmDelete(true)
            }}
          >
            <Trash2 aria-hidden="true" />
            Request account deletion
          </Button>
        </div>
      </SettingsSection>

      {/* FR-SET-2: deletion is a request to the school's administrator; the demo only confirms. */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Request account deletion?"
        description="Your school's administrator will be asked to delete your account and your notes. Once they do, it can't be undone."
        confirmLabel="Send request"
        onConfirm={() => {
          toast.success('Your request has been sent. Your administrator will contact you.')
        }}
      />
    </div>
  )
}
