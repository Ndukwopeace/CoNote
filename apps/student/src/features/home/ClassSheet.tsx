/**
 * The sheet that opens from the class chip (D102): the classes of today and the two days before
 * (D108), under "Today", "Yesterday" and the date, each with when it is. A class that has not
 * started is listed but cannot be chosen yet. Choosing one files the next notes under it.
 */

// The bottom sheet.
import { noteWindowState } from '@conote/core/noteWindow'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@conote/ui/sheet'

// Status and dates.
import { classesByDay, getClassStatus, isOpenForNotes } from '@/lib/classes'
import { formatClassTime } from '@/lib/dates'
// Class-name helper.
import { cn } from '@conote/ui/utils'
// Shapes.
import type { ClassSession, Course } from '@/types/domain'

/** What the sheet shows and calls. */
interface ClassSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The student's classes (those to offer are picked and grouped here), and the courses for codes.
  classes: readonly ClassSession[]
  courses: readonly Course[]
  // The chosen class, and what happens when another is picked.
  chosenId: string | null
  onChoose: (classId: string) => void
  // Used for "On now".
  now: Date
}

/** What a row says under the class: when it opens, "On now", "Closed", or its time (the heading has the day). */
function waitingOrWhen(session: ClassSession, now: Date) {
  // Where the class is in its note window (D123).
  const state = noteWindowState(session, now)
  // Still to come today: when it begins, and that it opens then.
  if (state === 'not_started')
    return `Opens at ${formatClassTime(session.startsAt, session.endsAt)}`
  // Over for more than an hour: its notes are closed.
  if (state === 'closed') return `Closed · ${formatClassTime(session.startsAt, session.endsAt)}`
  // On now.
  if (getClassStatus(session, now) === 'live') return 'On now'
  // Ended within the hour: still open, so its time.
  return formatClassTime(session.startsAt, session.endsAt)
}

/** The class sheet. */
export function ClassSheet({
  open,
  onOpenChange,
  classes,
  courses,
  chosenId,
  onChoose,
  now,
}: Readonly<ClassSheetProps>) {
  // The classes to choose from, grouped by day.
  const days = classesByDay(classes, now)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-3 p-5">
        <SheetTitle>Which class?</SheetTitle>
        <SheetDescription>
          {chosenId
            ? 'Change it only if you are writing about another class.'
            : 'Choose the class your notes are for. You can write from the start of a class until one hour after it ends.'}
        </SheetDescription>
        {/* No class in the last three days: say so, rather than show an empty list. */}
        {days.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You have no classes from the last three days.
          </p>
        )}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {days.map((day) => (
            <section key={day.label} aria-label={day.label} className="flex flex-col gap-2">
              {/* The day: Today, Yesterday, or the date. */}
              <h3 className="text-xs tracking-wider text-muted-foreground uppercase">
                {day.label}
              </h3>
              <ul className="flex flex-col gap-2">
                {day.classes.map((session) => {
                  // The class's course, for its code.
                  const course = courses.find((c) => c.id === session.courseId)
                  const chosen = session.id === chosenId
                  // A class that has not started, or whose notes window has closed, cannot be chosen
                  // (D108, D123).
                  const waiting = !isOpenForNotes(session, now)
                  return (
                    <li key={session.id}>
                      <button
                        type="button"
                        aria-pressed={chosen}
                        disabled={waiting}
                        onClick={() => {
                          onChoose(session.id)
                        }}
                        className={cn(
                          'flex min-h-14 w-full flex-col items-start justify-center rounded-2xl border px-4 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                          chosen ? 'border-primary bg-accent' : 'hover:border-primary',
                          waiting && 'cursor-not-allowed opacity-50 hover:border-border',
                        )}
                      >
                        {/* The course name leads; the code follows, small (D110). */}
                        <span className="font-semibold">
                          {course?.title} · {session.title}
                          <span className="ml-2 text-xs font-normal opacity-80">
                            {course?.code}
                          </span>
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {waitingOrWhen(session, now)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
