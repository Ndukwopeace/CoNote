/**
 * The "Set your password" dialog (D118). An invited person who has just signed in with an emailed
 * code has no password yet, so the frame asks for one before anything else. It cannot be closed
 * without choosing one; "Sign out" is the way out for someone who cannot choose now.
 */

// Connects the zod rules to the shared form.
import { zodResolver } from '@hookform/resolvers/zod'

// Buttons and the dialog.
import { Button } from '@conote/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@conote/ui/dialog'
// The shared new-password form.
import { NewPasswordForm } from '@conote/ui/forms/NewPasswordForm'

// The form's rules.
import { resetPasswordSchema, STAFF_MIN_PASSWORD_LENGTH } from '../auth/authSchemas'
// Saving, signing out, and request state for the form.
import { useAuth } from '../auth/useAuth'
import { useAuthRequest } from '../auth/useAuthRequest'

/** The form's rules, connected once rather than on every render. */
const RESOLVER = zodResolver(resetPasswordSchema)

/** A dialog that stays open until a password is saved. */
export function SetPasswordDialog() {
  // Saving the password, and leaving.
  const { setPassword, signOut } = useAuth()
  // Pending and error state for the form.
  const { error, isPending, run } = useAuthRequest()

  return (
    // Always open while it is rendered; the frame stops rendering it once the mark is gone.
    <Dialog open>
      <DialogContent
        hideClose
        // SECURITY-adjacent: the dialog must be answered, so Escape and clicks outside do nothing.
        onEscapeKeyDown={(event) => {
          event.preventDefault()
        }}
        onInteractOutside={(event) => {
          event.preventDefault()
        }}
      >
        {/* Names the dialog. */}
        <DialogTitle>Set your password</DialogTitle>
        {/* Says why, in one line. */}
        <DialogDescription>
          Choose a password so you can also sign in without waiting for an email code.
        </DialogDescription>
        {/* The rules line, both fields and the submit, shared with the reset page. */}
        <NewPasswordForm
          resolver={RESOLVER}
          minLength={STAFF_MIN_PASSWORD_LENGTH}
          error={error}
          isPending={isPending}
          submitLabel="Save password"
          onSubmit={async (password) => {
            // The frame closes the dialog when the session loses its mark; a refusal shows above.
            await run(() => setPassword(password))
          }}
        />
        {/* The way out for someone who cannot choose a password now. */}
        <Button
          type="button"
          variant="link"
          className="h-auto justify-self-start p-0 text-sm"
          onClick={() => void signOut()}
        >
          Sign out
        </Button>
      </DialogContent>
    </Dialog>
  )
}
