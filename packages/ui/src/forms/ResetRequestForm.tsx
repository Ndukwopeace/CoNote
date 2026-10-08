/**
 * The "send me a reset link" form, shared by every portal's forgot-password page. Each app
 * supplies its own email rules (as a resolver) and wording, and does the sending itself.
 */

// Form state, validation timing and field registration.
import { useForm, type Resolver } from 'react-hook-form'
// The link to the demo reset page.
import { Link } from 'react-router'

// Standard button.
import { Button } from '../components/button'
// Standard text input.
import { Input } from '../components/input'
// Labelled field with its inline error.
import { FormField } from './FormField'
// Error and success boxes.
import { FormMessage } from './FormMessage'

/** The form's one value. */
export interface ResetRequestValues {
  email: string
}

/** What the form needs from its page. */
interface ResetRequestFormProps {
  // The app's email rules.
  resolver: Resolver<ResetRequestValues>
  // What happens next, shown above the field.
  intro: string
  // The field's label.
  emailLabel: string
  // "email" for a sign-up email, "username" where the email is the sign-in name.
  emailAutoComplete: 'email' | 'username'
  // The words shown once sent.
  confirmation: string
  // The service's answer once sent, or null before. Its presence switches to the confirmation.
  sent: { demoResetPath?: string | undefined } | null
  // A failed request's message, if any.
  error: string | null
  // True while the request runs.
  isPending: boolean
  // Sends the request for a valid email.
  onSubmit: (email: string) => void | Promise<void>
}

/** Empty starting value. */
const EMPTY: ResetRequestValues = { email: '' }

/** The email form, or the confirmation once sent. */
export function ResetRequestForm({
  resolver,
  intro,
  emailLabel,
  emailAutoComplete,
  confirmation,
  sent,
  error,
  isPending,
  onSubmit,
}: Readonly<ResetRequestFormProps>) {
  // The form. Errors appear when the field loses focus and on submit.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver, mode: 'onTouched', defaultValues: EMPTY })

  // Confirmation state.
  if (sent) {
    return (
      <div className="mt-4 space-y-4">
        {/* SECURITY: the caller passes the same words whatever the email, so the page can't be
            used to find out who has an account (account enumeration). */}
        <FormMessage tone="success">{confirmation}</FormMessage>
        {/* Demo mode only: the demo service returns the link because it sends no email. A real
            service never returns one, so this never shows in production. */}
        {sent.demoResetPath && (
          <Button asChild className="w-full">
            <Link to={sent.demoResetPath}>Continue to reset (demo)</Link>
          </Button>
        )}
      </div>
    )
  }

  // Form state.
  return (
    <>
      {/* What happens next. */}
      <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
      {/* A failed request's message. */}
      {error && (
        <FormMessage tone="error" className="mt-4">
          {error}
        </FormMessage>
      )}
      {/* noValidate: the app's rules give the messages, not the browser. */}
      <form
        noValidate
        onSubmit={(event) => void handleSubmit(({ email }) => onSubmit(email))(event)}
        className="mt-6 space-y-4"
      >
        {/* Email. */}
        <FormField id="email" label={emailLabel} error={errors.email?.message}>
          {(field) => (
            <Input
              {...field}
              type="email"
              autoComplete={emailAutoComplete}
              {...register('email')}
            />
          )}
        </FormField>
        {/* Submit; disabled and relabelled while in flight. */}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </>
  )
}
