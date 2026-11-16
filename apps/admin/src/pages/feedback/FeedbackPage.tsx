/**
 * Feedback (D125): what people sent through the Feedback button in any app, newest first, with who
 * sent it and the page they were on. An administrator filters by status and kind and marks each
 * piece read. Messages are shown as plain text, so nothing a sender typed can run or link out.
 */

// The filters live in the address.
import { useSearchParams } from 'react-router'
// Empty-state icon.
import { MessageSquareText } from 'lucide-react'

// The tab title, the empty panel, the drop-down, the button and loading blocks.
import { PageTitle } from '@conote/ui/common/PageTitle'
import { EmptyState } from '@conote/ui/common/EmptyState'
import { NativeSelect } from '@conote/ui/native-select'
import { Button } from '@conote/ui/button'
import { Skeleton } from '@conote/ui/skeleton'
// Kinds and their words.
import { FEEDBACK_KINDS, FEEDBACK_KIND_LABELS, type FeedbackKind } from '@conote/core/feedback'
// Load-failure panel.
import { ErrorState } from '@conote/portal'

// The data.
import { useFeedbackList, useSetFeedbackStatus } from '@/hooks/useFeedback'
// The shapes.
import {
  FEEDBACK_PAGE_SIZE,
  type FeedbackFilter,
  type FeedbackItem,
  type FeedbackStatus,
} from '@/types/feedback'

/** Reads the status from the address; anything else means all. */
function statusFrom(value: string | null): FeedbackStatus | undefined {
  return value === 'new' || value === 'read' ? value : undefined
}

/** Reads the kind from the address; anything else means all. */
function kindFrom(value: string | null): FeedbackKind | undefined {
  return FEEDBACK_KINDS.find((kind) => kind === value)
}

/** A date and time as a person reads them. */
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

/** "Ada · ada@x.example · student · /dashboard · 10 Nov 2026, 09:00": who, from where, and when. */
function senderLine(item: FeedbackItem): string {
  // The name, or a note that the account is gone, then the email when there is one.
  const parts = [item.senderName ?? 'Deleted account']
  if (item.senderEmail) parts.push(item.senderEmail)
  // The role, the page when recorded, and the time.
  parts.push(item.senderRole)
  if (item.page !== null) parts.push(item.page)
  parts.push(formatWhen(item.createdAt))
  return parts.join(' · ')
}

/** One piece of feedback: who, when, what, and the way to mark it read. */
function FeedbackCard({ item }: Readonly<{ item: FeedbackItem }>) {
  // Marking it read or new.
  const setStatus = useSetFeedbackStatus()
  const next: FeedbackStatus = item.status === 'new' ? 'read' : 'new'
  return (
    <li className="space-y-2 px-4 py-3">
      {/* The kind, the score and the status. */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold">{FEEDBACK_KIND_LABELS[item.kind]}</span>
        {item.rating !== null && (
          <span className="text-muted-foreground">{`Score ${String(item.rating)} of 5`}</span>
        )}
        <span
          className={item.status === 'new' ? 'font-medium text-primary' : 'text-muted-foreground'}
        >
          {item.status === 'new' ? 'New' : 'Read'}
        </span>
      </p>
      {/* The message, as plain text. Long unbroken words wrap instead of running off the screen. */}
      <p className="text-sm [overflow-wrap:anywhere] whitespace-pre-wrap">{item.message}</p>
      {/* Who sent it, from where, and when. */}
      <p className="text-xs text-muted-foreground">{senderLine(item)}</p>
      {/* Mark it read, or new again. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={setStatus.isPending}
        onClick={() => {
          setStatus.mutate({ id: item.id, status: next })
        }}
      >
        {item.status === 'new' ? 'Mark as read' : 'Mark as new'}
      </Button>
      {/* A failed change says so, with words that name no table. */}
      {setStatus.isError && (
        <p role="alert" className="text-sm text-destructive">
          We could not change that. Try again.
        </p>
      )}
    </li>
  )
}

/** Feedback. */
export function FeedbackPage() {
  // The address's query holds the filters and the page.
  const [params, setParams] = useSearchParams()
  const status = statusFrom(params.get('status'))
  const kind = kindFrom(params.get('kind'))
  const offset = Math.max(Number.parseInt(params.get('offset') ?? '0', 10) || 0, 0)
  const filter: FeedbackFilter = { status, kind, offset }
  // The page of feedback.
  const { data, isPending, isError, refetch } = useFeedbackList(filter)

  /** Changes one filter and starts again from the first page. */
  function choose(name: 'status' | 'kind', value: string) {
    const next = new URLSearchParams(params)
    next.delete('offset')
    if (value === '') next.delete(name)
    else next.set(name, value)
    setParams(next)
  }
  /** Moves to the page starting at `start`. */
  function goTo(start: number) {
    const next = new URLSearchParams(params)
    if (start <= 0) next.delete('offset')
    else next.set('offset', String(start))
    setParams(next)
  }

  const total = data?.total ?? 0
  const last = Math.min(offset + FEEDBACK_PAGE_SIZE, total)

  return (
    <div className="space-y-6">
      {/* Tab title. */}
      <PageTitle title="Feedback" />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Feedback</h1>
        <p className="text-sm text-muted-foreground">
          What students, teachers and administrators sent through the Feedback button, newest first.
        </p>
      </div>
      {/* The filters. */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid w-full gap-1 text-sm sm:w-auto">
          <label htmlFor="feedback-status" className="font-medium">
            Status
          </label>
          <NativeSelect
            id="feedback-status"
            value={status ?? ''}
            onChange={(event) => {
              choose('status', event.target.value)
            }}
            className="sm:w-40"
          >
            <option value="">All</option>
            <option value="new">New</option>
            <option value="read">Read</option>
          </NativeSelect>
        </div>
        <div className="grid w-full gap-1 text-sm sm:w-auto">
          <label htmlFor="feedback-kind" className="font-medium">
            About
          </label>
          <NativeSelect
            id="feedback-kind"
            value={kind ?? ''}
            onChange={(event) => {
              choose('kind', event.target.value)
            }}
            className="sm:w-56"
          >
            <option value="">Everything</option>
            {FEEDBACK_KINDS.map((value) => (
              <option key={value} value={value}>
                {FEEDBACK_KIND_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {/* Failed: the message and a retry. */}
      {isError && <ErrorState thing="feedback" onRetry={() => void refetch()} />}
      {/* Loading. */}
      {isPending && (
        <output aria-label="Loading feedback" className="block space-y-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </output>
      )}
      {/* Nothing matches. */}
      {data && total === 0 && (
        <EmptyState icon={MessageSquareText} title="No feedback here.">
          {status === undefined && kind === undefined
            ? 'Nobody has sent feedback yet.'
            : 'Nothing matches these filters. Try others.'}
        </EmptyState>
      )}
      {/* The page, and the way to the others. */}
      {data && total > 0 && (
        <>
          <ul aria-label="Feedback" className="divide-y rounded-xl border bg-card">
            {data.items.map((item) => (
              <FeedbackCard key={item.id} item={item} />
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p>{`Showing ${String(offset + 1)} to ${String(last)} of ${String(total)}`}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={offset === 0}
                onClick={() => {
                  goTo(offset - FEEDBACK_PAGE_SIZE)
                }}
              >
                Previous page
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={last >= total}
                onClick={() => {
                  goTo(offset + FEEDBACK_PAGE_SIZE)
                }}
              >
                Next page
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
