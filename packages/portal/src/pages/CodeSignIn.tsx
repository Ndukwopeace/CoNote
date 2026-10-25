/**
 * Signing in with a code sent by email (D114): the person types their address, gets six digits,
 * and types them in. No password and no link, so there is no redirect list to get wrong and
 * nothing to remember. It is a second way in beside the password form, for the same accounts.
 */

// Local state for the steps and the field.
import { useEffect, useRef, useState } from 'react'

// Standard button and text input.
import { Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'
// Labelled field with its inline error, and the error box.
import { FormField } from '@conote/ui/forms/FormField'
import { FormMessage } from '@conote/ui/forms/FormMessage'

// The code and email rules.
import {
  SIGN_IN_CODE_LENGTH,
  cleanSignInCode,
  forgotPasswordSchema,
  signInCodeSchema,
} from '../auth/authSchemas'
// Sign-in actions, and request state for the forms.
import { useAuth } from '../auth/useAuth'
import { useAuthRequest } from '../auth/useAuthRequest'
// The wait before another code may be asked for.
import { useCooldown } from '../auth/useCooldown'

/** How long the person waits before asking for another code, in seconds. */
const RESEND_WAIT_SECONDS = 60

/** Sign-in's own wording: an account an administrator deactivated or suspended is told so. */
const CODE_MESSAGES = { forbidden: 'This account is not active. Contact your administrator.' }

/** What the code sign-in needs from the page. */
interface CodeSignInProps {
  // Goes back to the password form.
  onUsePassword: () => void
}

/** The two steps: the email, then the code. Signing in moves the person on through the guard. */
export function CodeSignIn({ onUsePassword }: Readonly<CodeSignInProps>) {
  // The two actions this form uses.
  const { requestSignInCode, signInWithCode } = useAuth()
  // Busy flag and error for asking for a code, and for checking one, kept apart so the two
  // messages do not overwrite each other.
  const ask = useAuthRequest()
  const check = useAuthRequest(CODE_MESSAGES)
  // The address, once it has been accepted: null while the first step is showing.
  const [email, setEmail] = useState<string | null>(null)
  // What is typed in each field.
  const [typedEmail, setTypedEmail] = useState('')
  const [code, setCode] = useState('')
  // The message about the field the person is on.
  const [fieldError, setFieldError] = useState<string | undefined>(undefined)
  // Demo mode only: the code the email would have carried.
  const [demoCode, setDemoCode] = useState<string | undefined>(undefined)
  // Whether a new code was just sent.
  const [resent, setResent] = useState(false)
  // The wait before another code.
  const cooldown = useCooldown(RESEND_WAIT_SECONDS)
  // The code field, to put the cursor in it and back after a wrong code.
  const codeInput = useRef<HTMLInputElement>(null)

  // The second step has one job, so the cursor starts in the code field and the number pad opens.
  useEffect(() => {
    if (email !== null) codeInput.current?.focus()
  }, [email])

  /** Asks for a code for `address`; the first time this moves to the code step. */
  async function sendCode(address: string, isNew: boolean) {
    const result = await ask.run(() => requestSignInCode(address))
    if (!result.ok) return
    setDemoCode(result.value.demoCode)
    // The wait starts with every email, so the limit on how often one goes out is never hit.
    cooldown.start()
    if (isNew) {
      setEmail(address)
      setCode('')
      setResent(false)
    } else {
      setResent(true)
    }
  }

  /** The email step's submit: checks the address like the form rules, then asks for the code. */
  async function submitEmail() {
    const parsed = forgotPasswordSchema.safeParse({ email: typedEmail })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message)
      return
    }
    setFieldError(undefined)
    await sendCode(parsed.data.email, true)
  }

  /** Checks the code; if it is right the page's guard sends the person on. */
  async function submitCode(text: string) {
    if (email === null) return
    // The same rule the service applies, so the message is the same.
    const parsed = signInCodeSchema.safeParse({ code: text })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message)
      return
    }
    setFieldError(undefined)
    // A new attempt hides the "new code sent" notice.
    setResent(false)
    const result = await check.run(() => signInWithCode(email, parsed.data.code))
    // Right: the guard moves the person on.
    if (result.ok) return
    // Wrong: empty the field and put the cursor back, so the next code can be typed at once.
    setCode('')
    codeInput.current?.focus()
  }

  // Step one: the address.
  if (email === null) {
    return (
      <>
        {/* Why a code could not be sent. */}
        {ask.error && (
          <FormMessage tone="error" className="mt-4">
            {ask.error}
          </FormMessage>
        )}
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void submitEmail()
          }}
          className="mt-6 space-y-4"
        >
          <p className="text-sm text-muted-foreground">
            We will email you a {SIGN_IN_CODE_LENGTH}-digit code. No password needed.
          </p>
          <FormField id="email" label="Email" error={fieldError}>
            {(field) => (
              <Input
                {...field}
                type="email"
                autoComplete="username"
                value={typedEmail}
                onChange={(event) => {
                  setTypedEmail(event.target.value)
                  setFieldError(undefined)
                }}
              />
            )}
          </FormField>
          <Button type="submit" className="w-full" disabled={ask.isPending}>
            {ask.isPending ? 'Sending…' : 'Send code'}
          </Button>
        </form>
        <Button
          type="button"
          variant="link"
          className="mt-4 h-auto p-0 text-sm"
          onClick={onUsePassword}
        >
          Sign in with a password instead
        </Button>
      </>
    )
  }

  // Step two: the code.
  return (
    <div className="mt-6 space-y-4">
      {/* Why the code failed, or why a new one could not be sent. */}
      {(check.error ?? ask.error) && (
        <FormMessage tone="error">{check.error ?? ask.error}</FormMessage>
      )}
      {/* A new code was sent. <output> has the built-in "status" role, so screen readers announce
          it politely. */}
      {resent && (
        <output className="block text-sm text-muted-foreground">
          A new code is on its way to {email}.
        </output>
      )}
      <p className="text-sm text-muted-foreground">
        If <strong className="font-semibold text-foreground">{email}</strong> has a CoNote account,
        a {SIGN_IN_CODE_LENGTH}-digit code is on its way. It can take a minute.
      </p>
      {/* Demo mode only: no email is sent, so the code is shown here. */}
      {demoCode && (
        <p
          data-testid="demo-code"
          className="rounded-md bg-primary-light px-3 py-2 text-xs text-primary-dark"
        >
          Demo: your code is <code className="font-semibold">{demoCode}</code>.
        </p>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submitCode(code)
        }}
        className="space-y-4"
      >
        {/* One-time-code lets phones offer the code from the email; numeric brings up the number
            pad. Digits only are kept, so a pasted "482 913" becomes 482913. */}
        <FormField id="code" label="Sign-in code" error={fieldError}>
          {(field) => (
            <Input
              {...field}
              ref={codeInput}
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="text-center font-mono text-xl tracking-[0.4em]"
              onChange={(event) => {
                // Only the digits are kept.
                const next = cleanSignInCode(event.target.value)
                setCode(next)
                setFieldError(undefined)
                // The last digit signs the person in at once, with no button to press.
                if (next.length === SIGN_IN_CODE_LENGTH && !check.isPending) void submitCode(next)
              }}
            />
          )}
        </FormField>
        {/* For anyone who prefers a button, or whose keyboard cannot paste a whole code. */}
        <Button type="submit" className="w-full" disabled={check.isPending}>
          {check.isPending ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
      {/* The ways out. */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Button
          type="button"
          variant="link"
          className="h-auto p-0"
          disabled={ask.isPending || cooldown.remaining > 0}
          onClick={() => void sendCode(email, false)}
        >
          {cooldown.remaining > 0
            ? `Send a new code in ${String(cooldown.remaining)}s`
            : 'Send a new code'}
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-auto p-0"
          onClick={() => {
            setEmail(null)
            setFieldError(undefined)
          }}
        >
          Use a different email
        </Button>
      </div>
      <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={onUsePassword}>
        Sign in with a password instead
      </Button>
      {/* Where a code that never arrives usually is. */}
      <p className="text-xs text-muted-foreground">
        Nothing yet? Look in your spam folder, then ask for a new code.
      </p>
    </div>
  )
}
