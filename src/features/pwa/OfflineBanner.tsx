/**
 * The offline banner (FR-PWA-4): says the connection is gone, and clears itself on reconnect.
 */

// Wifi-off icon.
import { WifiOff } from 'lucide-react'
// Subscribes to the browser's online/offline state.
import { useSyncExternalStore } from 'react'

/** Listens for the browser's online and offline events. */
function subscribe(onChange: () => void) {
  // Both directions of change.
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  // Clean-up when the banner unmounts.
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** The browser's current answer. */
function isOnline() {
  return navigator.onLine
}

/** A banner shown while the browser reports no connection. */
export function OfflineBanner() {
  // Re-renders whenever the connection changes.
  const online = useSyncExternalStore(subscribe, isOnline, () => true)

  return (
    // The live region stays in the page even when empty, so screen readers notice when text
    // appears in it. aria-live="polite" waits for a pause instead of interrupting. A plain
    // live region rather than role="status", which the pages keep for their own messages.
    <div aria-live="polite">
      {!online && (
        // Amber strip with an icon and the message.
        <span className="flex items-center gap-2 bg-warning-soft px-4 py-2 text-sm text-warning-strong">
          {/* Decorative icon; the text says it. */}
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          You&apos;re offline. Some things may not load until you reconnect.
        </span>
      )}
    </div>
  )
}
