/**
 * Ask CoNote AI, at /ask-ai (FR-AI-1 to FR-AI-6): a context picker and the chat. Opened from a
 * course, class or summary with ?courseId= or ?classId=.
 */

// State for the pending context change and the conversation's identity.
import { useState } from 'react'
// The query string.
import { useSearchParams } from 'react-router'

// Yes/no dialog.
import { ConfirmDialog } from '@conote/ui/common/ConfirmDialog'
// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Tab title.
import { PageTitle } from '@conote/ui/common/PageTitle'
// Loading placeholder.
import { ListSkeleton } from '@/components/common/Skeletons'
// The chat.
import { ChatPanel } from '@/features/ai/ChatPanel'
// Data hooks.
import { useMyClasses } from '@/hooks/useClasses'
import { useMyCourses } from '@/hooks/useCourses'
// Context rules.
import { contextFromParams, contextKey, contextSearch, parseContextKey } from '@/lib/aiContext'
// Shapes.
import type { AiContext, ClassSession, Course } from '@/types/domain'

/** The Ask AI page. */
export function AskAiPage() {
  // The courses and classes for the picker.
  const courses = useMyCourses()
  const classes = useMyClasses()

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      {/* Tab title. */}
      <PageTitle title="Ask CoNote AI" />
      {/* Page heading. */}
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Ask CoNote AI</h1>
      {/* The picker and chat once the lists load. */}
      <AskAiBody courses={courses} classes={classes} />
    </div>
  )
}

/** The loading, error or loaded state of the page body. */
function AskAiBody({
  courses,
  classes,
}: Readonly<{
  courses: ReturnType<typeof useMyCourses>
  classes: ReturnType<typeof useMyClasses>
}>) {
  // Failed.
  const failed = courses.error ?? classes.error
  if (failed) {
    return (
      <LoadError
        error={failed}
        onRetry={() => {
          void courses.refetch()
          void classes.refetch()
        }}
      />
    )
  }
  // Loading.
  if (!courses.data || !classes.data) return <ListSkeleton rows={3} />
  // Loaded.
  return <AskAi courses={courses.data} classes={classes.data} />
}

/** The picker and the chat. */
function AskAi({ courses, classes }: Readonly<{ courses: Course[]; classes: ClassSession[] }>) {
  // The address's query string.
  const [params, setParams] = useSearchParams()
  // The context, from the address; only the student's courses and classes count.
  const context = contextFromParams(params, courses, classes)
  // Counts conversations, so switching context remounts the chat and starts afresh.
  const [conversation, setConversation] = useState(0)
  // Whether the current conversation has messages (asked before switching).
  const [started, setStarted] = useState(false)
  // A switch waiting for confirmation.
  const [pending, setPending] = useState<AiContext | null>(null)

  /** Switches to `next`, starting a new conversation. */
  function switchTo(next: AiContext) {
    setParams(new URLSearchParams(contextSearch(next)), { replace: true })
    setConversation((n) => n + 1)
    setStarted(false)
  }

  return (
    <>
      {/* The context picker (FR-AI-2). */}
      <label className="flex flex-col gap-1.5 text-sm font-medium sm:flex-row sm:items-center sm:gap-3">
        {/* The words in their own element, so the space before the picker is explicit. */}
        <span>Context</span>
        <select
          value={contextKey(context)}
          onChange={(event) => {
            const next = parseContextKey(event.target.value, courses, classes)
            // Mid-conversation: ask first. Otherwise switch.
            if (started) setPending(next)
            else switchTo(next)
          }}
          className="h-10 rounded-md border bg-card px-3 font-normal sm:min-w-72"
        >
          <option value="all">All my courses</option>
          {courses.map((course) => (
            <optgroup key={course.id} label={course.code}>
              <option value={`course:${course.id}`}>{course.code} · whole course</option>
              {classes
                .filter((c) => c.courseId === course.id)
                .sort((a, b) => a.number - b.number)
                .map((c) => (
                  <option key={c.id} value={`class:${c.id}`}>
                    {c.number}. {c.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      {/* The chat; its key changes with each new conversation. */}
      <div className="flex h-[calc(100dvh-18rem)] min-h-96 flex-col rounded-xl border bg-card p-4">
        <ChatPanel
          key={`${contextKey(context)}#${String(conversation)}`}
          context={context}
          className="flex-1"
          onStarted={() => {
            setStarted(true)
          }}
        />
      </div>

      {/* FR-AI-2: one conversation never mixes two contexts. */}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        title="Start a new conversation?"
        description="Changing the context starts a new conversation."
        confirmLabel="Start new conversation"
        onConfirm={() => {
          if (pending) switchTo(pending)
          setPending(null)
        }}
      />
    </>
  )
}
