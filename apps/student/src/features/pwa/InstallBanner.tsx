/**
 * The "Get the CoNote app" strip at the top of the public pages (FR-PWA-6, decision D34).
 * It shows only where CoNote can actually be installed, and can be dismissed.
 */

// Icons: download for the offer, a cross for dismiss.
import { Download, X } from 'lucide-react'
// Local state for the dismissal and the iOS steps.
import { useState } from 'react'

// Standard button.
import { Button } from '@conote/ui/button'
// Builds the "conote:"-prefixed storage key.
import { storageKey } from '@/lib/storage'

// Which install option the browser supports, and the prompt action.
import { useInstallOption } from './installPrompt'
// The iOS "Add to Home Screen" steps.
import { IosInstallDialog } from './IosInstallDialog'

/** Where the dismissal is remembered. Holds only "1"; nothing about the visitor. */
const DISMISSED_KEY = storageKey('install-banner-dismissed')

/** True if the visitor closed the strip before. Blocked storage counts as "not closed". */
function wasDismissed() {
  try {
    // Present means closed.
    return window.localStorage.getItem(DISMISSED_KEY) !== null
  } catch {
    // Some private modes throw on any storage access; show the strip rather than crash.
    return false
  }
}

/** Remembers the dismissal for later visits, where storage allows. */
function rememberDismissed() {
  try {
    // Any value works; only presence is checked.
    window.localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // Storage blocked: the strip stays closed for this page view only, which is fine.
  }
}

/** A slim strip offering to install CoNote. Renders nothing where installing isn't possible. */
export function InstallBanner() {
  // "prompt", "ios" or "hidden", and the action that opens the browser's install dialog.
  const { option, install } = useInstallOption()
  // Whether the visitor has closed the strip; read once from storage.
  const [dismissed, setDismissed] = useState(wasDismissed)
  // Whether the iOS steps are showing.
  const [iosStepsOpen, setIosStepsOpen] = useState(false)

  // Nothing to install (already installed, or unsupported), or the visitor closed it.
  if (option === 'hidden' || dismissed) return null

  return (
    // Brand-coloured strip, full width.
    <div className="bg-primary text-primary-foreground">
      {/* Content capped like the header, and centred. */}
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm">
        {/* Decorative icon. */}
        <Download aria-hidden="true" className="size-4 shrink-0" />
        {/* The offer; the second half hides on narrow phones to keep one line. */}
        <p className="flex-1">
          <strong>Get the CoNote app.</strong>
          <span className="hidden sm:inline"> Open it from your home screen, even offline.</span>
        </p>
        {/* Install: the browser's dialog, or the iOS steps. */}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            // iOS has no install prompt, so show the manual steps instead.
            if (option === 'ios') setIosStepsOpen(true)
            else void install()
          }}
        >
          Install app
        </Button>
        {/* Close the strip; remembered so it doesn't return on every visit. */}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            rememberDismissed()
            setDismissed(true)
          }}
          className="rounded-md p-1 outline-none hover:bg-primary-dark focus-visible:ring-[3px] focus-visible:ring-primary-foreground/60"
        >
          {/* Decorative icon; the aria-label names the button. */}
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      {/* The iOS steps, opened by the button above. */}
      <IosInstallDialog open={iosStepsOpen} onOpenChange={setIosStepsOpen} />
    </div>
  )
}
