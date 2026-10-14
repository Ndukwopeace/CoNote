/**
 * The page Google sends the student back to (/auth/callback). It swaps the code in the address
 * for a session. On success the signed-in redirect around this route moves the student on, so
 * the only things shown here are the wait and the ways it can fail.
 */

// The spinner for the wait.
import { LoaderCircle } from 'lucide-react'
// Links and the query string.
import { Link, useSearchParams } from 'react-router'

// Sets the tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// Standard button.
import { Button } from '@conote/ui/button'
// Finishes the sign-in.
import { useProviderSignIn } from '@/features/auth/useProviderSignIn'
// Route constants.
import { ROUTES } from '@/lib/routes'

/** Finishes a Google sign-in, or explains why it could not be finished. */
export function AuthCallbackPage() {
  // What Google put in the address: a code, or an error.
  const params = useSearchParams()[0]
  // Where the sign-in stands.
  const state = useProviderSignIn(params.get('code'), params.get('error'))

  // Failed: say so, in our words, and offer the way back.
  if (state.status === 'failed') {
    return (
      <div>
        {/* Tab title. */}
        <PageTitle title="Google sign-in" />
        {/* The state is the heading, so it is the first thing read out. */}
        <h1 className="text-2xl font-bold">Google sign-in did not finish</h1>
        {/* Why, and what to do. */}
        <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
        {/* Back to the sign-in page, where the Google button is. */}
        <Button asChild className="mt-6 w-full">
          <Link to={ROUTES.login}>Back to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    // <output> has the built-in "status" role, so the wait is announced politely.
    <output className="flex items-center gap-2 text-sm text-muted-foreground">
      {/* Tab title while waiting. */}
      <PageTitle title="Google sign-in" />
      {/* Decorative spinner; the text says what is happening. */}
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      Finishing your sign-in…
    </output>
  )
}
