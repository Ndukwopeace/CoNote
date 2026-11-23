/**
 * The link students open for a form, with a button that copies it (D126). When the student site's
 * address is not set, only the path is shown, with a note on how to finish the link.
 */

// Icons for the button.
import { Check, Copy } from 'lucide-react'
// Whether the link was just copied.
import { useState } from 'react'

// Shared building blocks.
import { Button } from '@conote/ui/button'
import { Input } from '@conote/ui/input'

// The link and whether it is whole.
import { publicFormLink, studentAppUrlKnown } from '@/lib/studentAppUrl'

/** A read-only box with the form's link and a Copy button. */
export function ShareLink({ token }: Readonly<{ token: string }>) {
  const link = publicFormLink(token)
  // Whether the copy worked, shown for a moment.
  const [copied, setCopied] = useState(false)

  /** Puts the link on the clipboard. Where the browser refuses, the box can still be selected by hand. */
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      // The clipboard can be blocked (an insecure page, a denied permission); the link stays visible.
      setCopied(false)
    }
  }

  return (
    <div className="space-y-1 text-sm">
      <label htmlFor="form-link" className="font-medium">
        Link to share
      </label>
      <div className="flex gap-2">
        <Input
          id="form-link"
          readOnly
          value={link}
          onFocus={(event) => {
            event.target.select()
          }}
        />
        <Button type="button" variant="outline" onClick={() => void copy()}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
      {!studentAppUrlKnown() && (
        <p className="text-xs text-muted-foreground">
          Add this path to the address of the student site, for example
          https://your-site.example/f/… Set VITE_STUDENT_APP_URL to show the whole link here.
        </p>
      )}
    </div>
  )
}
