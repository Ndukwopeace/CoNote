/**
 * A draft waiting for review (D113): it opens to read, and the form opens only on request. This
 * holds which of the two is showing. The form keeps its place across a Reload after a conflict;
 * the reading view simply shows the newer draft.
 */

// Which view is showing.
import { useState } from 'react'

// The shape shown.
import type { ReviewDetails } from '@/types/review'

// The form and the reading view.
import { DraftEditor } from './DraftEditor'
import { DraftReader } from './DraftReader'

/** The draft, as text to read or as the form. `reloads` restarts the form from the latest draft. */
export function ReviewDraft({
  details,
  reloads,
  onReload,
}: Readonly<{ details: ReviewDetails; reloads: number; onReload: () => Promise<void> }>) {
  // Reading first.
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <DraftEditor
        key={reloads}
        details={details}
        onReload={onReload}
        onBack={() => {
          setEditing(false)
        }}
      />
    )
  }
  return (
    <DraftReader
      details={details}
      onEdit={() => {
        setEditing(true)
      }}
      onReload={onReload}
    />
  )
}
