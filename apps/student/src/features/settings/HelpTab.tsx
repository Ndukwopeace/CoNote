/**
 * Settings → Help & Support (FR-SET-5): FAQ, contact email, app version, and "Reset demo data"
 * in demo mode only.
 */

// Icons.
import { Mail, RotateCcw } from 'lucide-react'
// Dialog state.
import { useState } from 'react'

// Yes/no dialog.
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
// FAQ accordion and button.
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@conote/ui/accordion'
import { Button } from '@conote/ui/button'
// The injected services; `demo` exists only in demo mode.
import { useServices } from '@/services/useServices'

// The section card.
import { SettingsSection } from './SettingsSection'

/** Where students write for help. A placeholder address until the school provides one (D56). */
export const SUPPORT_EMAIL = 'support@conote.example'

/** Questions and answers. */
const FAQ = [
  {
    q: 'Who can see my notes?',
    a: 'Only you. Teachers and other students can’t open your notes. CoNote AI reads them, together with your classmates’ notes, to draft the class summary.',
  },
  {
    q: 'When will a class summary appear?',
    a: 'After the AI drafts it and your teacher reviews and approves it. The class page shows where it is: collecting notes, in progress, in review or published.',
  },
  {
    q: 'Can I change a note after the summary is published?',
    a: 'Yes, any time. The published summary won’t change, because it was approved from the notes at the time.',
  },
  {
    q: 'What does Ask CoNote AI answer from?',
    a: 'Approved summaries and your own notes, in the context you choose. Check important details with your teacher.',
  },
  {
    q: 'Can I use CoNote offline?',
    a: 'Yes, once installed. Notes and summaries you have opened stay readable offline; new changes need a connection.',
  },
  {
    q: 'I wasn’t added to a course. What do I do?',
    a: 'Your teacher or administrator enrols you. Ask them to add you; students can’t join courses themselves.',
  },
]

/** The Help & Support tab. */
export function HelpTab() {
  // The demo service, present only in demo mode.
  const { demo } = useServices()
  // Whether the reset dialog is open.
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="space-y-6">
      <SettingsSection title="Help & Support">
        {/* FAQ: one open at a time; a second click closes it. */}
        <Accordion type="single" collapsible>
          {FAQ.map(({ q, a }) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger>{q}</AccordionTrigger>
              <AccordionContent>{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SettingsSection>

      <SettingsSection title="Contact">
        <p className="flex items-center gap-2 text-sm">
          <Mail aria-hidden="true" className="size-4 text-primary" />
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
        {/* The build's version, for support requests. */}
        <p className="text-sm text-muted-foreground">Version {__APP_VERSION__}</p>
      </SettingsSection>

      {/* Demo mode only. */}
      {demo && (
        <SettingsSection
          title="Demo data"
          description="Put back the demo courses, notes and notifications."
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setConfirmReset(true)
            }}
          >
            <RotateCcw aria-hidden="true" />
            Reset demo data
          </Button>
          <ConfirmDialog
            open={confirmReset}
            onOpenChange={setConfirmReset}
            title="Reset demo data?"
            description="Notes you wrote, your profile changes and read notifications are removed, and the app reloads."
            confirmLabel="Reset"
            onConfirm={() => {
              demo.resetDemoData()
            }}
          />
        </SettingsSection>
      )}
    </div>
  )
}
