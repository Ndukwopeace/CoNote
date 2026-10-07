/**
 * The sign-up page at /signup (FR-AUTH-2). Full name, email, password twice, the required terms
 * checkbox, and the Google button. New accounts are always students.
 */

// Connects zod schemas to react-hook-form.
import { zodResolver } from '@hookform/resolvers/zod'
// Form state, validation timing and field registration.
import { useForm } from 'react-hook-form'
// Links to sign in and the legal pages.
import { Link } from 'react-router'

// Sets the tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// Labelled field with its inline error.
import { FormField } from '@/components/forms/FormField'
// Error box above the form.
import { FormMessage } from '@/components/forms/FormMessage'
// Password input with the show/hide toggle.
import { PasswordInput } from '@/components/forms/PasswordInput'
// Standard button.
import { Button } from '@conote/ui/button'
// Standard text input.
import { Input } from '@conote/ui/input'
// The Google button.
import { OAuthButtons } from '@/features/auth/OAuthButtons'
// Sign-up actions.
import { useAuth } from '@/features/auth/useAuth'
// Busy and error handling shared by the auth forms.
import { useAuthRequest } from '@/features/auth/useAuthRequest'
// The sign-up rules and the form's value type.
import { MAX_NAME_LENGTH, signUpSchema, type SignUpValues } from '@/lib/authSchemas'
// Route constants.
import { ROUTES } from '@/lib/routes'

/** Empty starting values, so every field is controlled from the first render. */
const EMPTY: SignUpValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
}

/**
 * Create an account. A successful sign-up signs the student in, and RedirectIfSignedIn then
 * opens the dashboard; the page itself never navigates.
 */
export function SignUpPage() {
  // The actions this page uses.
  const { signUp, signInWithProvider } = useAuth()
  // Busy flag, server error and the request runner.
  const { error, isPending, run } = useAuthRequest()
  // The form. Errors appear when a field loses focus and on submit (FR-AUTH-3).
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(signUpSchema), mode: 'onTouched', defaultValues: EMPTY })

  return (
    <div>
      {/* Tab title. */}
      <PageTitle title="Sign up" />
      {/* Page heading. */}
      <h1 className="text-2xl font-bold">Create your account</h1>
      {/* Subheading. */}
      <p className="mt-1 text-sm text-muted-foreground">
        Start writing notes and reading your class summaries.
      </p>

      {/* The server error, when there is one (FR-AUTH-6). */}
      {error && (
        <FormMessage tone="error" className="mt-4">
          {error}
        </FormMessage>
      )}

      {/* noValidate: the app reports errors itself. handleSubmit only passes valid values on,
          and only the three account fields are sent; the confirmation and checkbox stay here. */}
      <form
        noValidate
        onSubmit={(event) =>
          void handleSubmit(({ fullName, email, password }) =>
            run(() => signUp({ fullName, email, password })),
          )(event)
        }
        className="mt-6 space-y-4"
      >
        {/* Full name; maxLength stops typing past the limit instead of erroring afterwards. */}
        <FormField id="fullName" label="Full name" error={errors.fullName?.message}>
          {(field) => (
            <Input
              {...field}
              autoComplete="name"
              maxLength={MAX_NAME_LENGTH}
              {...register('fullName')}
            />
          )}
        </FormField>
        {/* Email. */}
        <FormField id="email" label="Email address" error={errors.email?.message}>
          {(field) => <Input {...field} type="email" autoComplete="email" {...register('email')} />}
        </FormField>
        {/* Password; "new-password" lets password managers suggest a strong one. */}
        <FormField id="password" label="Password" error={errors.password?.message}>
          {(field) => (
            <PasswordInput {...field} autoComplete="new-password" {...register('password')} />
          )}
        </FormField>
        {/* The same password again, to catch typos. */}
        <FormField
          id="confirmPassword"
          label="Confirm password"
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
        {/* The terms checkbox (FR-AUTH-2). */}
        <div className="space-y-1.5">
          {/* Label wraps the box so the text is clickable. The links open the legal pages. */}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-primary"
              // Marked invalid and linked to its error, like the text fields.
              {...(errors.acceptTerms
                ? { 'aria-invalid': true, 'aria-describedby': 'acceptTerms-error' }
                : {})}
              {...register('acceptTerms')}
            />
            <span>
              I agree to the{' '}
              {/* A new tab keeps the half-filled form, and keeps the installed app free of
                  public pages (D36). SECURITY: noopener stops the new tab reaching back into
                  this one through window.opener (reverse tabnabbing). */}
              <Link
                to={ROUTES.terms}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Terms of Service
                {/* Screen readers are told the link opens a new tab. */}
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>{' '}
              and{' '}
              {/* A new tab keeps the half-filled form, and keeps the installed app free of
                  public pages (D36). SECURITY: noopener stops the new tab reaching back into
                  this one through window.opener (reverse tabnabbing). */}
              <Link
                to={ROUTES.privacy}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Privacy Policy
                {/* Screen readers are told the link opens a new tab. */}
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
            </span>
          </label>
          {/* The checkbox's error, when there is one. */}
          {errors.acceptTerms && (
            <p id="acceptTerms-error" className="text-sm text-error-strong">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>
        {/* Submit; disabled and relabelled while a request is in flight (FR-AUTH-6). */}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>

      {/* Google creates the account and signs in straight away. */}
      <OAuthButtons
        disabled={isPending}
        onSelect={(provider) => void run(() => signInWithProvider(provider))}
      />

      {/* Link back to sign in. */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to={ROUTES.login} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
