/**
 * Home in Ask mode (D102, D103): the statement and suggested questions while empty, then the
 * conversation as bubbles, with the class chip and the same composer. The questions are about the
 * chosen class (or all courses while none is chosen). Remount it (change its key) to start a new
 * conversation.
 */

// State, refs and effects.
import { useEffect, useRef, useState } from 'react'

// The "+" menu.
import { DropdownMenuItem } from '@conote/ui/dropdown-menu'
// The conversation.
import { useChat } from '@/features/ai/useChat'
// Suggested questions.
import { suggestedPrompts } from '@/lib/aiReplies'
// Standard button.
import { Button } from '@conote/ui/button'
// Whether the AI is a demo (FR-AI-9).
import { PreviewBadge } from '@/components/common/PreviewBadge'
import { useServices } from '@/services/useServices'
// Shape.
import type { AiContext } from '@/types/domain'

import { ClassChip } from './ClassChip'
import { Composer } from './Composer'
import { Statement } from './Statement'

/** The conversation about `context`. */
export function AskMode({
  context,
  label,
  code,
  live,
  greeting,
  onOpenSheet,
}: Readonly<{
  context: AiContext
  label: string | null
  // The course code, shown small after the name.
  code: string | null
  live: boolean
  greeting: string
  onOpenSheet: () => void
}>) {
  // The conversation.
  const { messages, status, error, send, retry } = useChat(context)
  // The typed question.
  const [draft, setDraft] = useState('')
  // The demo's replies are examples, so Ask says so (FR-AI-9).
  const { ai } = useServices()
  // The end of the conversation, kept in view as it grows.
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, status])
  // Whether a reply is on its way.
  const waiting = status === 'waiting'
  // Whether nothing has been asked yet.
  const empty = messages.length === 0

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* The statement: "Ask CoNote" while empty. */}
        <Statement greeting={greeting} fill={empty}>
          {empty && (
            <div className="flex flex-col items-center gap-3">
              <p>Answers come from your notes and the summaries your teacher approved.</p>
              {ai.isPreview && <PreviewBadge />}
              <ul className="mt-2 flex w-full flex-col gap-2 text-left">
                {suggestedPrompts(context).map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      onClick={() => {
                        send(prompt)
                      }}
                      className="min-h-11 w-full rounded-2xl border bg-card px-4 py-3 text-left text-[0.9375rem] text-foreground outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {prompt}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Statement>
        {!empty && (
          <div
            role="log"
            aria-label="Conversation"
            className="mt-auto flex flex-col gap-3 px-4 pb-3"
          >
            <ul className="flex flex-col gap-3">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={
                    m.role === 'user'
                      ? 'ml-auto max-w-[86%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-base leading-snug whitespace-pre-line text-accent-foreground'
                      : 'mr-auto max-w-[92%] rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-base leading-snug whitespace-pre-line'
                  }
                >
                  {/* Who said it, for screen readers. */}
                  <span className="sr-only">{m.role === 'user' ? 'You: ' : 'CoNote AI: '}</span>
                  {/* SECURITY: rendered as text, never HTML, so a reply can't run code (XSS). */}
                  {m.content}
                </li>
              ))}
            </ul>
            {/* The reply is on its way. */}
            {waiting && <p className="text-sm text-muted-foreground">CoNote AI is typing…</p>}
            {/* A failure, inline, with Retry (FR-AI-5). */}
            {status === 'error' && (
              <div
                role="alert"
                className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm"
              >
                <p className="flex-1">{error}</p>
                <Button type="button" size="sm" variant="outline" onClick={retry}>
                  Retry
                </Button>
              </div>
            )}
            {ai.isPreview && (
              <p className="text-xs text-muted-foreground">
                Preview: replies are examples while the AI service is being built.
              </p>
            )}
            <div ref={end} />
          </div>
        )}
      </div>

      <div className="space-y-2 px-3 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2 px-1 pb-1">
          <ClassChip label={label} code={code} live={live} onClick={onOpenSheet} />
        </div>
        <Composer
          label="Ask a question"
          placeholder="Ask about your classes…"
          sendLabel="Send"
          value={draft}
          onChange={setDraft}
          onSubmit={() => {
            send(draft)
            setDraft('')
          }}
          busy={waiting}
          menu={<DropdownMenuItem onSelect={onOpenSheet}>Change class</DropdownMenuItem>}
        />
        {/* FR-AI-4. */}
        <p className="px-3 text-xs text-muted-foreground">
          Answers are based on approved summaries and your notes. Check important details with your
          teacher.
        </p>
      </div>
    </>
  )
}
