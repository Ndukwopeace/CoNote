/**
 * Where a class's summary is in its lifecycle, in the student's words (REQUIREMENTS.md section 4).
 */

// Icons, one per stage.
import { CheckCircle2, Clock, Loader, NotebookPen, type LucideIcon } from 'lucide-react'
// Type for the optional action.
import type { ReactNode } from 'react'

// The wording for each stage.
import { summaryStateMessage } from '@/lib/summaryState'
// The stage type.
import type { SummaryStatus } from '@/types/domain'

/** The icon for each stage. */
const STAGE_ICONS: Record<SummaryStatus, LucideIcon> = {
  // Notes are still being written.
  collecting: NotebookPen,
  // The AI is working.
  processing: Loader,
  // The teacher is reviewing.
  in_review: Clock,
  // Ready to read.
  published: CheckCircle2,
}

/** A card with the stage's title and sentence, plus an optional action such as a link. */
export function SummaryStateCard({
  status,
  action,
}: Readonly<{ status: SummaryStatus; action?: ReactNode }>) {
  // The wording.
  const { title, message } = summaryStateMessage(status)
  // The icon.
  const Icon = STAGE_ICONS[status]

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
      {/* Decorative icon; green once published. */}
      <span
        className={
          status === 'published'
            ? 'flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-strong'
            : 'flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary'
        }
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      {/* Title and sentence. */}
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {/* The action, when there is one. */}
      {action}
    </div>
  )
}
