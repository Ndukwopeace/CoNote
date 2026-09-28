import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router'

import { PageTitle } from '@/components/common/PageTitle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/useAuth'
import { errorMessage } from '@/lib/errorMessages'
import { toAppError } from '@/lib/errors'
import { ROUTES } from '@/lib/routes'
import type { OAuthProvider } from '@/types/auth'

function textField(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}

/**
 * Working sign-in for M1. M2 replaces the form handling with react-hook-form + zod.
 * No navigation here: RedirectIfSignedIn moves the student on once the session exists.
 */
export function LoginPage() {
  const { signIn, signInWithProvider } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function run(action: () => Promise<unknown>) {
    setError(null)
    setIsPending(true)
    try {
      await action()
    } catch (caught) {
      setError(errorMessage(toAppError(caught)))
      setIsPending(false)
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(() =>
      signIn({
        email: textField(form, 'email'),
        password: textField(form, 'password'),
        remember: form.get('remember') === 'on',
      }),
    )
  }

  function handleProvider(provider: OAuthProvider) {
    void run(() => signInWithProvider(provider))
  }

  return (
    <div>
      <PageTitle title="Sign in" />
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to continue to CoNote.</p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-error-soft px-3 py-2 text-sm text-error-strong"
        >
          {error}
        </p>
      )}

      <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email address
          </label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="remember" className="size-4 accent-primary" />
            Remember me
          </label>
          <Link to={ROUTES.forgotPassword} className="font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          Sign in
        </Button>
      </form>

      <p className="my-6 text-center text-xs text-muted-foreground">or continue with</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          variant="outline"
          aria-label="Continue with Google"
          disabled={isPending}
          onClick={() => {
            handleProvider('google')
          }}
        >
          Google
        </Button>
        <Button
          variant="outline"
          aria-label="Continue with Microsoft"
          disabled={isPending}
          onClick={() => {
            handleProvider('microsoft')
          }}
        >
          Microsoft
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link to={ROUTES.signup} className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
