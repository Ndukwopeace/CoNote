/**
 * The sheet that opens from the class chip (D102): every class of the student's, the ones that
 * have started first (latest first), then the ones to come, each with when it is. Choosing one
 * files the next notes under it.
 */

// The bottom sheet.
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@conote/ui/sheet'

// Status and dates.
import { getClassStatus } from '@/lib/classes'
import { formatClassDate, formatClassTime } from '@/lib/dates'
// Class-name helper.
import { cn } from '@conote/ui/utils'
// Shapes.
import type { ClassSession, Course } from '@/types/domain'

/** What the sheet shows and calls. */
interface ClassSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The classes to offer, already ordered, and the courses for their codes.
  classes: readonly ClassSession[]
  courses: readonly Course[]
  // The chosen class, and what happens when another is picked.
  chosenId: string | null
  onChoose: (classId: string) => void
  // Used for "On now".
  now: Date
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-3 p-5">
        <SheetTitle>Which class?</SheetTitle>
        <SheetDescription>
          {chosenId
            ? 'Change it only if you are writing about another class.'
            : 'Choose the class your notes are for.'}
        </SheetDescription>
        <ul className="flex flex-col gap-2 overflow-y-auto">
          {classes.map((session) => {
            // The class's course, for its code.
            const course = courses.find((c) => c.id === session.courseId)
            const chosen = session.id === chosenId
            return (
              <li key={session.id}>
                <button
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => {
                    onChoose(session.id)
                  }}
                  className={cn(
                    'flex min-h-14 w-full flex-col items-start justify-center rounded-2xl border px-4 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    chosen ? 'border-primary bg-accent' : 'hover:border-primary',
                  )}
                >
                  <span className="font-semibold">
                    {course?.code} · {session.title}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {getClassStatus(session, now) === 'live'
                      ? 'On now'
                      : `${formatClassDate(session.startsAt)}, ${formatClassTime(session.startsAt, session.endsAt)}`}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
