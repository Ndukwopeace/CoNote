/**
 * A password input with a show/hide toggle (FR-AUTH-1), so students can check what they typed
 * on a phone keyboard.
 */

// Eye icons for the toggle.
import { Eye, EyeOff } from 'lucide-react'
// Local state for the toggle, and the prop types.
import { useState, type ComponentProps } from 'react'

// The standard text input.
import { Input } from '@conote/ui/input'
// Class-name helper.
import { cn } from '@conote/ui/utils'

/** Every normal input attribute except `type`, which the toggle controls. */
type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'>

/** A password input with a show/hide button inside its right edge. */
export function PasswordInput({ className, ...props }: Readonly<PasswordInputProps>) {
  // Whether the characters are currently visible. Hidden by default.
  const [visible, setVisible] = useState(false)

  return (
    // Positioning context for the button.
    <div className="relative">
      {/* The input; right padding leaves room for the button. `ref` and every other prop pass
          through, so form libraries can register it. */}
      <Input type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      {/* The toggle. type="button" so it never submits the form. A fixed label with aria-pressed
          is the pattern screen readers announce best ("Show password, toggle button, pressed"). */}
      <button
        type="button"
        aria-label="Show password"
        aria-pressed={visible}
        onClick={() => {
          setVisible((current) => !current)
        }}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {/* The icon shows the action: an open eye to show, a crossed eye to hide. Decorative. */}
        {visible ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </button>
    </div>
  )
}
