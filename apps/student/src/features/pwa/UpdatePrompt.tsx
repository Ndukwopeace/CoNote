/**
 * The "new version available" toast (FR-PWA-5). A new deploy never replaces the app while the
 * student is looking at it: the toast asks, and nothing reloads while a note has unsaved changes.
 * Once the app is out of sight with nothing unsaved, the waiting version is applied by itself
 * (D117), so students who never tap Reload still get it on their next open.
 */

// Refresh icon.
import { RefreshCw } from 'lucide-react'
// Keeps the registration and last check time between renders; runs the focus listener.
import { useEffect, useRef } from 'react'
// The plugin's service-worker registration hook. In development and tests it does nothing, so
// the service worker only ever registers in production builds (FR-PWA-2).
import { useRegisterSW } from 'virtual:pwa-register/react'

// Standard button.
import { Button } from '@conote/ui/button'
// When to check, and when the toast may show.
import { shouldApplyUpdateQuietly, shouldCheckForUpdate, shouldShowUpdatePrompt } from '@/lib/pwa'

// The unsaved-changes flag the toast waits for.
import { useHasUnsavedChanges } from './unsavedChanges'

/** The part of a service-worker registration this component uses. */
interface Registration {
  // Asks the server whether a new service worker exists.
  update: () => Promise<unknown>
}

/** A toast at the bottom of the screen when a new version is waiting. */
export function UpdatePrompt() {
  // The registration, once the service worker has registered.
  const registration = useRef<Registration | null>(null)
  // When the app last asked for a new version; null before the first check.
  const lastCheckedAt = useRef<number | null>(null)
  // Register the service worker and learn when a new version is waiting.
  const {
    needRefresh: [updateReady, setUpdateReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Keep it for the focus checks.
      registration.current = reg ?? null
      // Registering fetches the service worker, which is itself a check.
      lastCheckedAt.current = Date.now()
    },
  })
  // Whether a note is being edited with unsaved changes.
  const hasUnsavedChanges = useHasUnsavedChanges()

  // When the student comes back to the app, look for a new version, at most once per interval.
  useEffect(() => {
    /** Checks for a new version unless one was checked recently. */
    function checkForUpdate() {
      // The current time.
      const now = Date.now()
      // Too soon, or not registered yet: skip.
      if (!registration.current || !shouldCheckForUpdate(lastCheckedAt.current, now)) return
      // Record the check first, so a second event straight after doesn't check twice.
      lastCheckedAt.current = now
      // Ask the server; a failure (e.g. offline) just means no update this time.
      registration.current.update().catch(() => undefined)
    }
    /** Runs when the page is shown or hidden; only coming back should check. */
    function onVisibilityChange() {
      // Leaving the app is not a reason to check.
      if (document.visibilityState === 'visible') checkForUpdate()
    }
    // Desktop browsers send focus when the window is selected again.
    window.addEventListener('focus', checkForUpdate)
    // iOS home-screen apps often send no focus event when reopened, but they do report the page
    // becoming visible again (D37).
    document.addEventListener('visibilitychange', onVisibilityChange)
    // Stop on unmount.
    return () => {
      window.removeEventListener('focus', checkForUpdate)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  // The newest values for the listener below, which is set up once and must not use stale ones.
  const latest = useRef({ updateReady, hasUnsavedChanges, updateServiceWorker })
  // Keep them current after every render.
  useEffect(() => {
    latest.current = { updateReady, hasUnsavedChanges, updateServiceWorker }
  })

  // Apply a waiting update while the app is out of sight and nothing is unsaved (D117), so the next
  // time the student opens CoNote it is the new version without anyone tapping Reload.
  useEffect(() => {
    /** Applies the update if this is a quiet moment. */
    function applyIfQuiet() {
      // The newest state.
      const {
        updateReady: ready,
        hasUnsavedChanges: unsaved,
        updateServiceWorker: apply,
      } = latest.current
      // Not a quiet moment: leave it to the toast.
      if (
        !shouldApplyUpdateQuietly({
          updateReady: ready,
          hasUnsavedChanges: unsaved,
          visibility: document.visibilityState,
        })
      ) {
        return
      }
      // Activate the new version and reload the page into it.
      void apply(true)
    }
    // The student leaves the app (or comes back, which is then skipped).
    document.addEventListener('visibilitychange', applyIfQuiet)
    // An update that finished downloading, or a note that was saved, while out of sight.
    applyIfQuiet()
    // Stop on unmount.
    return () => {
      document.removeEventListener('visibilitychange', applyIfQuiet)
    }
  }, [updateReady, hasUnsavedChanges])

  // Stay hidden unless an update is waiting and nothing unsaved would be lost.
  if (!shouldShowUpdatePrompt({ updateReady, hasUnsavedChanges })) return null

  return (
    // Bottom of the screen, above the phone bottom bar; centred and capped in width.
    <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md md:bottom-6">
      {/* The toast. <output> has the polite "status" role, so it is announced without
          interrupting the student. */}
      <output className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-lg">
        {/* Decorative icon. */}
        <RefreshCw aria-hidden="true" className="size-5 shrink-0 text-primary" />
        {/* The message. */}
        <span className="flex-1 text-sm font-medium">A new version of CoNote is available</span>
        {/* Hide until the next update. */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setUpdateReady(false)
          }}
        >
          Later
        </Button>
        {/* Activate the new version and reload the page into it. */}
        <Button type="button" size="sm" onClick={() => void updateServiceWorker(true)}>
          Reload
        </Button>
      </output>
    </div>
  )
}
