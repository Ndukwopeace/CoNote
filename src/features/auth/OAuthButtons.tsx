/**
 * The "or continue with" Google and Microsoft buttons (decision D3), shared by sign in and
 * sign up.
 */

// "google" or "microsoft".
import type { OAuthProvider } from '@/types/auth'
// Standard button.
import { Button } from '@/components/ui/button'

/** What the buttons need from the page. */
interface OAuthButtonsProps {
  // Disabled while any request is in flight.
  disabled: boolean
  // Called with the chosen provider.
  onSelect: (provider: OAuthProvider) => void
}

/** Each provider's id and visible name, in display order. */
const PROVIDERS: { id: OAuthProvider; name: string }[] = [
  // Google first, as in the wireframes.
  { id: 'google', name: 'Google' },
  // Then Microsoft.
  { id: 'microsoft', name: 'Microsoft' },
]

/** A divider line and one button per provider. */
export function OAuthButtons({ disabled, onSelect }: OAuthButtonsProps) {
  return (
    <div className="mt-6">
      {/* "or continue with", centred on a horizontal rule. The rules are decorative. */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <p>or continue with</p>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      {/* Buttons stacked on phones, side by side from 640 px. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PROVIDERS.map(({ id, name }) => (
          // The visible text is just the name; aria-label gives screen readers the whole action.
          <Button
            key={id}
            type="button"
            variant="outline"
            aria-label={`Continue with ${name}`}
            disabled={disabled}
            onClick={() => {
              onSelect(id)
            }}
          >
            {/* The provider's initial as a simple, brand-neutral mark. Decorative. */}
            <span
              aria-hidden="true"
              className="grid size-5 place-items-center rounded-full bg-muted text-xs font-bold"
            >
              {name[0]}
            </span>
            {name}
          </Button>
        ))}
      </div>
    </div>
  )
}
