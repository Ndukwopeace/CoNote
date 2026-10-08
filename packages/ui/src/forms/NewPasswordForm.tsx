/**
 * The "choose a new password" form, shared by every portal's reset-password page. Each app
 * supplies its own password rules (as a resolver) and minimum length, and does the saving itself.
 */

// Form state, validation timing and field registration.
import { useForm, type Resolver } from 'react-hook-form'

// Standard button.
import { Button } from '../components/button'
// Labelled field with its inline error.
import { FormField } from './FormField'
// Error box.
import { FormMessage } from './FormMessage'
// Password input with the show/hide toggle.
import { PasswordInput } from './PasswordInput'

/** The form's values: the password and the same again. */
export interface NewPasswordValues {
  password: string
  confirmPassword: string
}

/** What the form needs from its page. */
interface NewPasswordFormProps {
  // The app's password rules, including the match check.
  resolver: Resolver<NewPasswordValues>
  // The app's minimum length, stated in the rules line.
  minLength: number
  // A failed save's message, if any, such as a link used up in another tab.
  error: string | null
  // True while the save runs.
  isPending: boolean
  // Saves a valid password.
  onSubmit: (password: string) => void | Promise<void>
}

/** Empty starting values. */
const EMPTY: NewPasswordValues = { password: '', confirmPassword: '' }

/** The rules line, the two password fields and the submit button. */
export function NewPasswordForm({
  resolver,
  minLength,
  error,
  isPending,
  onSubmit,
}: Readonly<NewPasswordFormProps>) {
  // The form. Errors appear when a field loses focus and on submit.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver, mode: 'onTouched', defaultValues: EMPTY })

  return (
    <>
      {/* The rules, stated up front so nobody has to guess them. */}
      <p className="mt-1 text-sm text-muted-foreground">
        Use at least {minLength} characters, with a letter and a number.
      </p>
      {/* A failed save's message. */}
      {error && (
        <FormMessage tone="error" className="mt-4">
          {error}
        </FormMessage>
      )}
      {/* noValidate: the app's rules give the messages, not the browser. */}
      <form
        noValidate
        onSubmit={(event) => void handleSubmit(({ password }) => onSubmit(password))(event)}
        className="mt-6 space-y-4"
      >
        {/* New password; "new-password" lets password managers suggest and save it. */}
        <FormField id="password" label="New password" error={errors.password?.message}>
          {(field) => (
            <PasswordInput {...field} autoComplete="new-password" {...register('password')} />
          )}
        </FormField>
        {/* The same again, to catch typos. */}
        <FormField
          id="confirmPassword"
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
        {/* Submit; disabled and relabelled while in flight. */}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </>
  )
}
