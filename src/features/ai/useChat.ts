/**
 * One Ask CoNote AI conversation (FR-AI-1, FR-AI-5, FR-AI-6). Held in component state only: it
 * lasts for the page visit and is never written to storage or the offline cache.
 */

// State, refs and stable callbacks.
import { useCallback, useEffect, useRef, useState } from 'react'

// Student-facing wording for errors.
import { errorMessage } from '@/lib/errorMessages'
// Normalises anything thrown.
import { toAppError } from '@/lib/errors'
// Reports failures.
import { reportError } from '@/lib/reportError'
// The injected services.
import { useServices } from '@/services/useServices'
// Shapes.
import type { AiContext, AiMessage } from '@/types/domain'

/** Where the conversation stands. */
export type ChatStatus = 'idle' | 'waiting' | 'error'

/** A new message. */
function message(role: AiMessage['role'], content: string): AiMessage {
  return { id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString() }
}

/** The conversation for `context`, and the actions on it. */
export function useChat(context: AiContext) {
  // The AI service.
  const { ai } = useServices()
  // The messages so far.
  const [messages, setMessages] = useState<AiMessage[]>([])
  // Waiting, failed or ready.
  const [status, setStatus] = useState<ChatStatus>('idle')
  // The failure's wording, when failed.
  const [error, setError] = useState<string | null>(null)
  // Bumped when the chat closes, so a late reply isn't added to a conversation that has gone.
  const generation = useRef(0)

  // A closed chat ignores replies still on their way.
  useEffect(
    () => () => {
      generation.current += 1
    },
    [],
  )

  /** Asks the AI to answer `conversation` (which ends with the student's question). */
  const ask = useCallback(
    (conversation: AiMessage[]) => {
      // This request's generation.
      const current = generation.current
      setStatus('waiting')
      setError(null)
      ai.askAi(context, conversation)
        .then((reply) => {
          if (current !== generation.current) return
          setMessages((existing) => [...existing, message('assistant', reply)])
          setStatus('idle')
        })
        .catch((failure: unknown) => {
          reportError(failure, { where: 'useChat.ask' })
          if (current !== generation.current) return
          setError(errorMessage(toAppError(failure)))
          setStatus('error')
        })
    },
    [ai, context],
  )

  /** Sends a question. Blank questions, and questions while waiting, are ignored. */
  const send = useCallback(
    (text: string) => {
      const question = text.trim()
      if (question === '' || status === 'waiting') return
      const conversation = [...messages, message('user', question)]
      setMessages(conversation)
      ask(conversation)
    },
    [ask, messages, status],
  )

  /** Asks again after a failure, with the same question. */
  const retry = useCallback(() => {
    ask(messages)
  }, [ask, messages])

  return { messages, status, error, send, retry }
}
