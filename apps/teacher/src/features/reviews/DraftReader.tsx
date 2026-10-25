/**
 * The draft a teacher reads before deciding (D113): the AI's summary as text, with Approve &
 * Publish and Edit above it. Most drafts are read and approved as they are, so the form opens only
 * when the teacher asks for it. Approving asks first, like the form does, and sends the draft
 * exactly as loaded, so a draft that changed meanwhile (another tab) is refused, not overwritten.
 */

// Icon.
import { Pencil } from 'lucide-react'
// The failure being shown.
import { useState } from 'react'

// The shared error helpers.
import { reportError } from '@conote/core/reportError'
import { toAppError, type AppError } from '@conote/core/errors'
// Buttons, the question and the confirmation toast.
import { Button } from '@conote/ui/button'
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
import { useToast } from '@conote/ui/toast'

// Publishing.
import { usePublishDraft } from '@/hooks/useReview'
// The shape shown.
import type { ReviewDetails } from '@/types/review'

// The four parts as text, and a failure said in words.
import { DraftProblem } from './DraftProblem'
import { DraftSections } from './DraftSections'

/** What the reading view needs. */
interface DraftReaderProps {
  details: ReviewDetails
  // Opens the form.
  onEdit: () => void
  // Loads the latest draft; used after a conflict.
  onReload: () => Promise<void>
}

/** The draft to read, with the two actions. */
export function DraftReader({ details, onEdit, onReload }: Readonly<DraftReaderProps>) {
  // Short confirmations.
  const toast = useToast()
  // Publishing.
  const publish = usePublishDraft(details.summaryId)
  // The last failure, or null.
  const [problem, setProblem] = useState<AppError | null>(null)
  // Whether the publish question is showing.
  const [confirming, setConfirming] = useState(false)

  /** The teacher said yes: publish the draft as it was loaded. */
  function publishNow() {
    setConfirming(false)
    setProblem(null)
    publish.mutate(
      { draft: details.draft, version: details.version },
      {
        onSuccess: () => {
          toast.success('Summary published.')
        },
        onError: (error) => {
          // SECURITY: only the safe wording reaches the screen; the details go to the reporter.
          reportError(error, { where: 'DraftReader.publish' })
          setProblem(toAppError(error))
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      {/* The two ways forward: approve it as it is, or change it first. */}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={publish.isPending}
          onClick={() => {
            setConfirming(true)
          }}
        >
          {publish.isPending ? 'Publishing…' : 'Approve & Publish'}
        </Button>
        <Button type="button" variant="outline" disabled={publish.isPending} onClick={onEdit}>
          <Pencil aria-hidden="true" />
          Edit
        </Button>
      </div>

      {/* A failed publish. A changed draft offers Reload. */}
      {problem && (
        <DraftProblem
          problem={problem}
          onReload={() => {
            setProblem(null)
            void onReload()
          }}
        />
      )}

      {/* The draft. */}
      <DraftSections draft={details.draft} />

      {/* The publish question (teacher REQUIREMENTS section 2: it always asks first). */}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Publish this summary?"
        description={`Students in ${details.courseCode} will see it.`}
        confirmLabel="Approve & Publish"
        confirmVariant="default"
        onConfirm={publishNow}
      />
    </div>
  )
}
