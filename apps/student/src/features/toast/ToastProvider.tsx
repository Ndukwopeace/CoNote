/**
 * Toasts: short messages at the bottom of the screen after a save, a delete or a failure
 * (FR-NTE-6, section 11). Built here rather than added as a library (decision D44): the app
 * needs two tones and a timer.
 */

// Icons: tick, warning and close.
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
// State, stable callbacks, memoised value and the timer clean-up.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

// The context and its type.
import { ToastContext, type ToastApi } from './ToastContext'

/** How long a toast stays: 5 seconds, long enough to read two short sentences. */
export const TOAST_DURATION_MS = 5000
/** At most this many toasts at once; older ones make way. */
const MAX_TOASTS = 3

/** One toast on screen. */
interface Toast {
  // Unique within this page view.
  id: number
  // Success or error.
  tone: 'success' | 'error'
  // The text. Always plain text, never HTML.
  message: string
}

/** Holds the toasts and renders them above the page. */
export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  // The toasts showing.
  const [toasts, setToasts] = useState<Toast[]>([])
  // The next ID.
  const nextId = useRef(1)
  // Each toast's timer, so they can be cleared when the provider unmounts.
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  /** Removes one toast and its timer. */
  const dismiss = useCallback((id: number) => {
    // Stop its timer.
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    // Remove it.
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  /** Adds a toast and starts its timer. */
  const show = useCallback(
    (tone: Toast['tone'], message: string) => {
      // A new ID.
      const id = nextId.current++
      // Newest last; keep only the latest few.
      setToasts((current) => [...current, { id, tone, message }].slice(-MAX_TOASTS))
      // Remove it later.
      timers.current.set(
        id,
        setTimeout(() => {
          dismiss(id)
        }, TOAST_DURATION_MS),
      )
    },
    [dismiss],
  )

  // Clear every timer when the provider goes away (tests, sign-out re-mounts).
  useEffect(() => {
    // The map at mount time is the same object throughout.
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
    }
  }, [])

  // The functions handed to the app; stable, so consumers don't re-render needlessly.
  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => {
        show('success', message)
      },
      error: (message) => {
        show('error', message)
      },
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The stack: above the phone bottom bar, bottom right on larger screens. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex flex-col items-center gap-2 md:inset-x-auto md:right-6 md:bottom-6 md:items-end">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** One toast. Errors are alerts (read at once); successes are status messages (read politely). */
function ToastItem({
  toast,
  onDismiss,
}: Readonly<{ toast: Toast; onDismiss: (id: number) => void }>) {
  // The shared look and content.
  const content = (
    <>
      {/* Decorative icon by tone. */}
      {toast.tone === 'success' ? (
        <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-success-strong" />
      ) : (
        <AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-error-strong" />
      )}
      {/* The message, as text. */}
      <p className="flex-1 text-sm">{toast.message}</p>
      {/* Close by hand. */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          onDismiss(toast.id)
        }}
        className="rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </>
  )
  // Card look; pointer events back on so the button works.
  const className =
    'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border bg-card p-3 shadow-lg'

  // Errors interrupt; successes wait their turn (<output> is a polite live region).
  return toast.tone === 'error' ? (
    <div role="alert" className={className}>
      {content}
    </div>
  ) : (
    <output className={className}>{content}</output>
  )
}
