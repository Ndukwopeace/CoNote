/**
 * The code step of sign-up (D99): the student types the digits that were emailed to them and is
 * signed in the moment the last digit is in. Also offers a new code, and a way back to the form
 * when the address was wrong.
 */

// Local state for the field and the notice.
import { useEffect, useRef, useState } from 'react'

// Labelled field with its inline error.
import { FormField } from '@conote/ui/forms/FormField'
// Error and success boxes above the form.
import { FormMessage } from '@conote/ui/forms/FormMessage'
// Standard button.
import { Button } from '@conote/ui/button'
// Standard text input.
import { Input } from '@conote/ui/input'
// Sign-up actions.
import { useAuth } from '@/features/auth/useAuth'
// Busy and error handling shared by the auth forms.
import { useAuthRequest } from '@/features/auth/useAuthRequest'
// The wait before another code may be asked for.
import { useCooldown } from '@/features/auth/useCooldown'
// The code rules.
import { SIGN_UP_CODE_LENGTH, cleanSignUpCode, signUpCodeSchema } from '@/lib/authSchemas'
// The remembered sign-up, forgotten once it is finished.
import { clearPendingSignup } from '@/lib/pendingSignup'

/** How long the student waits before asking for another code, in seconds. */
const RESEND_WAIT_SECONDS = 60

/** What the form needs from the page. */
interface VerifyCodeFormProps {
  // The address the code was sent to.
  email: string
  // Goes back to the sign-up form, for a wrong address.
  onChangeEmail: () => void
}

/** The code field, the verify button, "send a new code" and "use a different email". */
export function VerifyCodeForm({ email, onChangeEmail }: Readonly<VerifyCodeFormProps>) {
  // The two actions this form uses.
  const { verifySignUpCode, resendSignUpCode } = useAuth()
  // Busy flag, server error and the request runner, for checking the code.
  const check = useAuthRequest()
  // The same for asking for a new code, so the two messages do not overwrite each other.
  const resend = useAuthRequest()
  // What is typed, and the message about it.
  const [code, setCode] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>(undefined)
  // Whether a new code was just sent.
  const [resent, setResent] = useState(false)
  // The wait before another code.
  const cooldown = useCooldown(RESEND_WAIT_SECONDS)
  // The field, to put the cursor in it and back after a wrong code.
  const input = useRef<HTMLInputElement>(null)

  // This screen has one job, so the cursor starts in the field and the number pad opens at once.
  useEffect(() => {
    input.current?.focus()
  }, [])

  /** Checks the code and, if it is right, signs the student in (the sign-up page then moves on). */
  async function submit(text: string) {
    // The same rules the service applies, so the message is the same.
    const parsed = signUpCodeSchema.safeParse({ code: text })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message)
      return
    }
    setFieldError(undefined)
    // A new attempt hides the "new code sent" notice.
    setResent(false)
    const result = await check.run(() => verifySignUpCode(email, parsed.data.code))
    // Right: the sign-up is finished, so the remembered address is no longer needed.
    if (result.ok) {
      clearPendingSignup()
      return
    }
    // Wrong: empty the field and put the cursor back, so the next code can be typed at once.
    setCode('')
    input.current?.focus()
  }

  /** Asks for a new code and starts the wait. */
  async function sendNewCode() {
    const result = await resend.run(() => resendSignUpCode(email))
    if (result.ok) {
      setResent(true)
      cooldown.start()
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Why the code failed, or why a new one could not be sent. */}
      {(check.error ?? resend.error) && (
        <FormMessage tone="error">{check.error ?? resend.error}</FormMessage>
      )}
      {/* A new code was sent. <output> has the built-in "status" role, so screen readers announce
          it politely. */}
      {resent && (
        <output className="block text-sm text-muted-foreground">
          A new code is on its way to {email}.
        </output>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submit(code)
        }}
        className="space-y-4"
      >
        {/* The code. One-time-code lets phones offer it from the email; numeric brings up the
            number pad. Digits only are kept, so a pasted "482 913" becomes 482913. */}
        <FormField id="code" label="Verification code" error={fieldError}>
          {(field) => (
            <Input
              {...field}
              ref={input}
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="text-center font-mono text-xl tracking-[0.4em]"
              onChange={(event) => {
                // Only the digits are kept.
                const next = cleanSignUpCode(event.target.value)
                setCode(next)
                setFieldError(undefined)
                // The last digit signs the student in at once, with no button to press.
                if (next.length === SIGN_UP_CODE_LENGTH && !check.isPending) void submit(next)
              }}
            />
          )}
        </FormField>
        {/* For anyone who prefers a button, or whose keyboard cannot paste a whole code. */}
        <Button type="submit" className="w-full" disabled={check.isPending}>
          {check.isPending ? 'Checking…' : 'Verify'}
        </Button>
      </form>
      {/* The two ways out. */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Button
          type="button"
          variant="link"
          className="h-auto p-0"
          disabled={resend.isPending || cooldown.remaining > 0}
          onClick={() => void sendNewCode()}
        >
          {cooldown.remaining > 0
            ? `Send a new code in ${String(cooldown.remaining)}s`
            : 'Send a new code'}
        </Button>
        <Button type="button" variant="link" className="h-auto p-0" onClick={onChangeEmail}>
          Use a different email
        </Button>
      </div>
      {/* Where a code that never arrives usually is. */}
      <p className="text-xs text-muted-foreground">
        Nothing yet? Look in your spam folder. If you already have an account with this email, sign
        in or reset your password instead.
      </p>
    </div>
  )
}
