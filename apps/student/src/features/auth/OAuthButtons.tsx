/**
 * The "or continue with" Google button (decision D38), shared by sign in and sign up. It
 * follows Google's sign-in branding: white button, grey border, the four-colour "G" on the left
 * and the words "Continue with Google".
 */

// Standard button.
import { Button } from '@conote/ui/button'
// The provider type; Google is the only one.
import type { OAuthProvider } from '@/types/auth'

/** What the button needs from the page. */
interface OAuthButtonsProps {
  // Disabled while any request is in flight.
  disabled: boolean
  // Called with the chosen provider.
  onSelect: (provider: OAuthProvider) => void
}

/**
 * Google's "G" in its official colours, drawn inline so it needs no image request and stays
 * sharp at any size. Decorative: the button's text says what it does.
 */
function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5 shrink-0">
      {/* Red, top arc. */}
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      {/* Blue, right side and crossbar. */}
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      {/* Yellow, left side. */}
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      {/* Green, bottom arc. */}
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

/** A divider line and the Google button. */
export function OAuthButtons({ disabled, onSelect }: Readonly<OAuthButtonsProps>) {
  return (
    <div className="mt-6">
      {/* "or continue with", centred on a horizontal rule. The rules are decorative. */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <p>or continue with</p>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      {/* Full width, white with a grey border as Google's branding asks. The visible text is the
          button's accessible name. */}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          onSelect('google')
        }}
        className="mt-4 w-full gap-3 bg-white text-[#1f1f1f] hover:bg-gray-50"
      >
        <GoogleLogo />
        Continue with Google
      </Button>
    </div>
  )
}
