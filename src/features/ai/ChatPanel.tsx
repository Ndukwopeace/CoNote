/**
 * The Ask CoNote AI chat: messages, suggested prompts on an empty conversation, a typing
 * indicator, inline errors with Retry, the input and the disclaimer (FR-AI-1, FR-AI-4, FR-AI-5).
 * Used on the Ask AI page and beside a summary.
 */

// Icons.
import { AlertTriangle, SendHorizontal, Sparkles } from 'lucide-react'
// The typed question.
import { useId, useState } from 'react'

// Standard button.
import { Button } from '@/components/ui/button'
// Suggested prompts.
import { suggestedPrompts } from '@/lib/aiReplies'
// Class-name helper.
import { cn } from '@/lib/utils'
// The context shape.
import type { AiContext } from '@/types/domain'

// The conversation.
import { useChat } from './useChat'

/** The chat for `context`. Remount it (change its key) to start a new conversation. */
export function ChatPanel({
  context,
  className,
  onStarted,
}: Readonly<{
  context: AiContext
  className?: string
  // Called when the first question is sent, so a page can ask before switching context.
  onStarted?: () => void
}>) {
  // The conversation.
  const { messages, status, error, send: sendMessage, retry } = useChat(context)

  /** Sends a question, and tells the page the conversation has started. */
  function send(text: string) {
    if (text.trim() === '') return
    sendMessage(text)
    onStarted?.()
  }
  // The text being typed.
  const [draft, setDraft] = useState('')
  // IDs linking the box to its disclaimer.
  const disclaimerId = useId()
  // Whether a reply is on its way.
  const waiting = status === 'waiting'

  /** Sends the typed question and clears the box. */
  function submit() {
    if (draft.trim() === '' || waiting) return
    send(draft)
    setDraft('')
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      {/* The conversation. role="log" announces new messages politely as they arrive. */}
      <div
        role="log"
        aria-label="Conversation"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto"
      >
        <ul className="space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-line',
                m.role === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'mr-auto border bg-card text-foreground',
              )}
            >
              {/* Who said it, for screen readers. */}
              <span className="sr-only">{m.role === 'user' ? 'You: ' : 'CoNote AI: '}</span>
              {/* SECURITY: rendered as text, never HTML, so a reply can't run code (XSS). */}
              {m.content}
            </li>
          ))}
        </ul>
        {/* Typing indicator (FR-AI-5). */}
        {waiting && (
          <p className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
            <span aria-hidden="true" className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </span>
            CoNote AI is typing…
          </p>
        )}
      </div>

      {/* Suggested prompts on an empty conversation (FR-AI-1). */}
      {messages.length === 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles aria-hidden="true" className="size-4 text-primary" />
            Try asking
          </p>
          <ul className="flex flex-col gap-2">
            {suggestedPrompts(context).map((prompt) => (
              <li key={prompt}>
                <button
                  type="button"
                  onClick={() => {
                    send(prompt)
                  }}
                  className="w-full rounded-lg border bg-card px-3 py-2 text-left text-sm outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* A failure, inline, with Retry (FR-AI-5). */}
      {status === 'error' && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border border-error-soft bg-card p-3 text-sm"
        >
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-error-strong" />
          <p className="flex-1">{error}</p>
          <Button type="button" size="sm" variant="outline" onClick={retry}>
            Retry
          </Button>
        </div>
      )}

      {/* The input. Enter sends; Shift+Enter adds a line (FR-AI-1). */}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="flex items-end gap-2"
      >
        <textarea
          aria-label="Ask a question"
          aria-describedby={disclaimerId}
          rows={2}
          value={draft}
          disabled={waiting}
          placeholder="Ask about your summaries and notes"
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            // Enter alone sends; while an input method is composing text, Enter belongs to it.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              submit()
            }
          }}
          className="min-h-11 flex-1 resize-none rounded-md border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          disabled={waiting || draft.trim() === ''}
        >
          <SendHorizontal aria-hidden="true" />
        </Button>
      </form>
      {/* FR-AI-4. */}
      <p id={disclaimerId} className="text-xs text-muted-foreground">
        Answers are based on approved summaries and your notes. Check important details with your
        teacher.
      </p>
    </div>
  )
}
