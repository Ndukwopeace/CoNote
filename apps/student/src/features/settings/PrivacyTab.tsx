/**
 * Settings → Privacy (FR-SET-4): who can see what, in plain words, and "Download my notes".
 */

// Icons.
import { Download, Lock } from 'lucide-react'
// Busy state while downloading.
import { useState } from 'react'

// Standard button.
import { Button } from '@conote/ui/button'
// Toast messages.
import { useToast } from '@/features/toast/useToast'
// The notes export.
import { notesExport } from '@/lib/exportNotes'
// Reports failures.
import { reportError } from '@conote/core/reportError'
// The injected services, to read every note at the moment of export.
import { useServices } from '@/services/useServices'

// The section card.
import { SettingsSection } from './SettingsSection'

/** The privacy rules, in plain words (section 1). */
const RULES = [
  'Only you can read your notes. Teachers and other students can’t open them.',
  'CoNote AI reads the notes for a class together to draft its summary. The summary doesn’t name who wrote what.',
  'Your teacher checks and approves every summary before any student sees it.',
  'Ask CoNote AI answers from approved summaries and your own notes, never from other students’ notes.',
  'Signing out removes your notes and drafts from this device.',
]

/** Hands `text` to the browser as a file to save. */
function downloadFile(text: string, filename: string) {
  // A temporary address for the file, and a link to it.
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  // Clicking the link starts the download; then tidy up.
  link.click()
  URL.revokeObjectURL(url)
}

/** The Privacy tab. */
export function PrivacyTab() {
  // The note service.
  const { notes } = useServices()
  // Toasts.
  const toast = useToast()
  // Whether a download is being prepared.
  const [busy, setBusy] = useState(false)

  /** Reads every note now, and downloads them as JSON. */
  async function downloadNotes() {
    setBusy(true)
    try {
      const now = new Date()
      downloadFile(
        notesExport(await notes.listMyNotes(), now),
        `conote-notes-${now.toISOString().slice(0, 10)}.json`,
      )
      toast.success('Your notes were downloaded.')
    } catch (error) {
      reportError(error, { where: 'PrivacyTab.downloadNotes' })
      toast.error("Couldn't download your notes. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Privacy" description="Who can see what in CoNote.">
        <ul className="space-y-3">
          {RULES.map((rule) => (
            <li key={rule} className="flex gap-3 text-sm">
              <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              {rule}
            </li>
          ))}
        </ul>
      </SettingsSection>
      <SettingsSection title="Your data" description="A copy of all your notes as a JSON file.">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void downloadNotes()}
        >
          <Download aria-hidden="true" />
          Download my notes
        </Button>
      </SettingsSection>
    </div>
  )
}
