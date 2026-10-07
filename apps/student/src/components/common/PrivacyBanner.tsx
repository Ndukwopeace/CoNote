/**
 * The reminder at the top of every class notes list that notes are private (FR-CLS-3).
 */

// Lock icon.
import { Lock } from 'lucide-react'

/** A soft brand strip with a lock and the fixed privacy sentence. */
export function PrivacyBanner() {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-primary-light px-4 py-3 text-sm text-accent-foreground">
      {/* Decorative icon. */}
      <Lock aria-hidden="true" className="size-4 shrink-0" />
      {/* The exact FR-CLS-3 wording. */}
      Your notes are private. You can only see your own notes.
    </p>
  )
}
