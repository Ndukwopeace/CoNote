/**
 * Home (D102, D103), laid out like the approved mockup: a top bar (menu, Note | Ask, bell), the
 * stream and composer in the middle, the history navigation as a drawer on phones and a sidebar
 * on wider screens, and the class sheet. It owns which class is chosen and which mode is open.
 */

// State.
import { useState } from 'react'
// The query string.
import { useSearchParams } from 'react-router'

// The drawer.
// The phone drawer.
import { NavDrawer } from '@/layouts/NavDrawer'
// Failed-load panel and loading placeholder.
import { LoadError } from '@/components/common/LoadError'
import { ListSkeleton } from '@/components/common/Skeletons'
// "You're offline" banner (FR-PWA-4).
import { OfflineBanner } from '@/features/pwa/OfflineBanner'
// Class rules.
import { defaultNoteClass, getClassStatus, hasClassStarted } from '@/lib/classes'
// The time, kept current.
import { useNote } from '@/hooks/useNoteMutations'
import { useNow } from '@/hooks/useNow'
// Shapes.
import type { AppError } from '@conote/core/errors'
import type { ClassSession, Course } from '@/types/domain'

import { AskMode } from './AskMode'
import { ClassSheet } from './ClassSheet'
import { HomeNav } from './HomeNav'
import { NoCourses } from './NoCourses'
import { NoteMode } from './NoteMode'
import { Statement } from './Statement'
import { TopBar, type HomeMode } from './TopBar'

/** What the screen needs from the data. */
interface HomeScreenProps {
  // Where the data stands. The frame (menu, switch, bell, navigation, offline banner) shows in
  // every state, so a student can always leave Home, even while it loads or offline.
  status: 'loading' | 'error' | 'ready'
  // Why loading failed, and how to try again.
  error?: AppError | null
  onRetry: () => void
  // Empty until `status` is "ready".
  courses: Course[]
  classes: ClassSession[]
  // Summaries not opened yet, and notifications not read yet.
  newSummaries: number
  unread: number
  // "Good evening, Victory."
  greeting: string
}

/** The Home screen. */
export function HomeScreen({
  status,
  error,
  onRetry,
  courses,
  classes,
  newSummaries,
  unread,
  greeting,
}: Readonly<HomeScreenProps>) {
  // The current time, for "today" and the live dot.
  const now = useNow()
  // Note or Ask, and the class from the address (a link from a summary), if it is the student's.
  const [params, setParams] = useSearchParams()
  const mode: HomeMode = params.get('mode') === 'ask' ? 'ask' : 'note'
  // The class the student chose, if they did. Otherwise the one from the address (a link from a
  // summary), else the one on now (or just over), else none, and the student chooses. That guess
  // is made once, when the data arrives, so a class starting while the student types doesn't
  // swap it.
  const [picked, setPicked] = useState<string | null>(null)
  const [guessed, setGuessed] = useState<string | null | undefined>(undefined)
  if (status === 'ready' && guessed === undefined) {
    setGuessed(
      // A class that has not started is not taken from the address (D107).
      classes.find((c) => c.id === params.get('classId') && hasClassStarted(c, new Date()))?.id ??
        defaultNoteClass(classes, new Date())?.id ??
        null,
    )
  }
  // A note to edit in the composer (D109): from the address, if it is the student's note.
  const editId = params.get('edit')
  const editQuery = useNote(editId ?? '', editId !== null)
  const editNote = editId !== null ? editQuery.data : undefined
  // A note being edited keeps its own class, whatever else was chosen.
  const chosenId = editNote ? editNote.classId : (picked ?? guessed ?? null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const chosen = classes.find((c) => c.id === chosenId)
  const course = courses.find((c) => c.id === chosen?.courseId)
  // "SWE 311 · SDLC Models", while a class is chosen.
  const label = chosen && course ? `${course.code} · ${chosen.title}` : null
  // Whether the class is on now.
  const live = chosen ? getClassStatus(chosen, now) === 'live' : false

  /** Leaves editing (after a save, or on Cancel): the address loses `edit`, the rest stays. */
  function endEdit() {
    const updated = new URLSearchParams(params)
    updated.delete('edit')
    setParams(updated, { replace: true })
  }

  /** Chooses a class. A class chosen while a note is edited ends the edit first. */
  function choose(classId: string) {
    if (editNote) endEdit()
    setPicked(classId)
  }

  /** Switches mode, keeping the rest of the address. */
  function setMode(next: HomeMode) {
    const updated = new URLSearchParams(params)
    if (next === 'ask') updated.set('mode', 'ask')
    else updated.delete('mode')
    setParams(updated, { replace: true })
  }

  /** The navigation, for the sidebar and the drawer. */
  function nav(onDone?: () => void) {
    return (
      <HomeNav
        classes={classes}
        courses={courses}
        chosenId={chosenId}
        onChoose={choose}
        now={now}
        newSummaries={newSummaries}
        {...(onDone ? { onDone } : {})}
      />
    )
  }

  return (
    <div className="flex h-dvh bg-background text-foreground">
      {/* Wider screens: the navigation is always there. */}
      <aside className="hidden w-72 shrink-0 border-r bg-card md:block">{nav()}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          mode={mode}
          onModeChange={setMode}
          onMenu={() => {
            setDrawerOpen(true)
          }}
          unread={unread}
        />
        <OfflineBanner />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col outline-none"
        >
          {status === 'loading' && (
            <div className="p-4">
              <ListSkeleton rows={3} />
            </div>
          )}
          {status === 'error' && error && (
            <div className="p-4">
              <LoadError error={error} onRetry={onRetry} />
            </div>
          )}
          {status === 'ready' && courses.length === 0 && (
            // Nothing to write for yet: the way to find courses, under the statement.
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <Statement greeting={greeting} fill={false} />
              <NoCourses />
            </div>
          )}
          {status === 'ready' && courses.length > 0 && mode === 'note' && (
            <NoteMode
              // A different note, or none, starts the composer over with its own text.
              key={editNote?.id ?? 'new'}
              chosen={chosen}
              label={label}
              live={live}
              greeting={greeting}
              onOpenSheet={() => {
                setSheetOpen(true)
              }}
              onAsk={() => {
                setMode('ask')
              }}
              editing={editNote}
              focusComposer={params.get('write') === '1'}
              onEditDone={endEdit}
            />
          )}
          {status === 'ready' && courses.length > 0 && mode === 'ask' && (
            <AskMode
              // A new class starts a new conversation.
              key={chosen?.id ?? 'all'}
              context={
                chosen
                  ? { scope: 'class', courseId: chosen.courseId, classId: chosen.id }
                  : { scope: 'all' }
              }
              label={label}
              live={live}
              greeting={greeting}
              onOpenSheet={() => {
                setSheetOpen(true)
              }}
            />
          )}
        </main>
      </div>

      {/* Phones: the navigation slides in from the left. */}
      <NavDrawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        {nav(() => {
          setDrawerOpen(false)
        })}
      </NavDrawer>

      <ClassSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        classes={classes}
        courses={courses}
        chosenId={chosenId}
        now={now}
        onChoose={(classId) => {
          choose(classId)
          setSheetOpen(false)
        }}
      />
    </div>
  )
}
