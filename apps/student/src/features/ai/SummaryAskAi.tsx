/**
 * Ask CoNote AI beside a summary (FR-SUM-4): a side panel on desktop; on smaller screens a
 * floating button that opens the same chat as a bottom sheet.
 */

// Icon.
import { Sparkles } from 'lucide-react'
// Whether the sheet is open.
import { useState } from 'react'

// Bottom sheet.
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@conote/ui/sheet'
// The context shape.
import type { AiContext } from '@/types/domain'

// The chat.
import { ChatPanel } from './ChatPanel'

/** The panel and the phone button, scoped to one class's summary. */
export function SummaryAskAi({
  courseId,
  classId,
}: Readonly<{ courseId: string; classId: string }>) {
  // The chat's context: this class.
  const context: AiContext = { scope: 'class', courseId, classId }
  // Whether the phone sheet is open.
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop: a panel beside the summary, kept in view while scrolling. */}
      <aside
        aria-labelledby="summary-ai-heading"
        className="hidden h-[calc(100dvh-8rem)] flex-col gap-3 rounded-xl border bg-card p-4 lg:sticky lg:top-24 lg:flex"
      >
        <h2 id="summary-ai-heading" className="flex items-center gap-2 font-semibold">
          <Sparkles aria-hidden="true" className="size-4 text-primary" />
          Ask CoNote AI
        </h2>
        <p className="text-sm text-muted-foreground">Questions about this class.</p>
        <ChatPanel context={context} className="flex-1" />
      </aside>

      {/* Phones and tablets: a floating button above the tab bar. */}
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
        className="fixed right-4 bottom-24 z-30 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg outline-none hover:bg-primary-dark focus-visible:ring-[3px] focus-visible:ring-ring/50 md:bottom-6 lg:hidden"
      >
        <Sparkles aria-hidden="true" className="size-4" />
        Ask CoNote AI
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" closeLabel="Close Ask CoNote AI" className="h-[85dvh]">
          <SheetTitle className="flex items-center gap-2 font-semibold">
            <Sparkles aria-hidden="true" className="size-4 text-primary" />
            Ask CoNote AI
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Questions about this class.
          </SheetDescription>
          {/* Only mounted while open; closing ends this conversation. */}
          <ChatPanel context={context} className="flex-1" />
        </SheetContent>
      </Sheet>
    </>
  )
}
