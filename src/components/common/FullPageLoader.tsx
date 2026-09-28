/**
 * Full-screen spinner shown while the session is checked or a page's code is loading.
 */

// Spinning circle icon.
import { LoaderCircle } from 'lucide-react'

/** A centred spinner that screen readers announce as "Loading". */
export function FullPageLoader() {
  return (
    // role="status" plus the label tells assistive technology something is loading.
    <div role="status" aria-label="Loading" className="grid min-h-dvh place-items-center">
      {/* The visual spinner; hidden from screen readers because the label already says it. */}
      <LoaderCircle aria-hidden="true" className="size-8 animate-spin text-primary" />
    </div>
  )
}
