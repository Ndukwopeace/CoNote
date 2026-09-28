/**
 * Note, at /notes/:noteId. A placeholder until milestone M4 builds the real page.
 */

// Temporary page body naming the milestone.
import { PlaceholderPage } from '@/components/common/PlaceholderPage'

/** Note page. */
export function NotePage() {
  // The heading, the milestone and a one-line description of the finished page.
  return (
    <PlaceholderPage
      title="Note"
      milestone="M4"
      description="Read a note, its tags and the class it belongs to."
    />
  )
}
