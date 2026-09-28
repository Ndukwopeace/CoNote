/**
 * Messages shown above a form: a server error (FR-AUTH-6) or a success notice.
 */

// Icons for each kind.
import { CircleAlert, CircleCheck } from 'lucide-react'
// The message content type.
import type { ReactNode } from 'react'

// Class-name helper.
import { cn } from '@/lib/utils'

/** What a message shows. */
interface FormMessageProps {
  // "error" is announced at once; "success" is announced politely.
  tone: 'error' | 'success'
  // The text.
  children: ReactNode
  // Extra classes, e.g. spacing.
  className?: string
}

/** A coloured message box with an icon. */
export function FormMessage({ tone, children, className }: FormMessageProps) {
  // Which icon to show.
  const Icon = tone === 'error' ? CircleAlert : CircleCheck

  return (
    <div
      // role="alert" interrupts screen readers for errors; role="status" waits for a pause.
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        // Icon and text side by side.
        'flex items-start gap-2 rounded-md px-3 py-2 text-sm',
        // Red for errors, green for success.
        tone === 'error'
          ? 'bg-error-soft text-error-strong'
          : 'bg-success-soft text-success-strong',
        className,
      )}
    >
      {/* Decorative icon; the text carries the meaning. */}
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {/* The message. */}
      <p>{children}</p>
    </div>
  )
}
