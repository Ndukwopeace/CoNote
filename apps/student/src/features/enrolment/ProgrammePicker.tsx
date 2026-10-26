/**
 * "Join programme" (D105, D106, D115), the whole body of the join dialog: the student chooses the
 * year they study in, then sees only that year's open programmes, each with the courses joining it
 * adds. A student asks, an administrator approves, and only then are the courses added. A student
 * belongs to one programme, so once they are in one it is the only thing shown, and while a request
 * waits only that request is shown; withdrawing it brings the choice back.
 */

// The chosen year.
import { useState } from 'react'

// Badge, button and loading block.
import { Badge } from '@conote/ui/badge'
import { Button } from '@conote/ui/button'
import { Skeleton } from '@conote/ui/skeleton'
// The inline message.
import { FormMessage } from '@conote/ui/forms/FormMessage'

// Failed-load panel.
import { LoadError } from '@/components/common/LoadError'
// Data hooks.
import {
  useCancelProgrammeRequest,
  useJoinableProgrammes,
  useRequestProgramme,
} from '@/hooks/useEnrolment'
// The year a programme is in, and its words.
import { programmeYear, yearLabel } from '@/lib/programmeYear'
// Words for a refused request.
import { joinMessage } from './joinMessage'
// Shapes.
import type { JoinableProgramme } from '@/types/domain'

/** A year's button: the year, or "other" for programmes whose code names none. */
type YearKey = number | 'other'

/** Groups the programmes by year, years from the lowest and "other" last. */
function groupByYear(programmes: readonly JoinableProgramme[]) {
  // Each year's programmes, in the order the service listed them.
  const groups = new Map<YearKey, JoinableProgramme[]>()
  for (const programme of programmes) {
    // A programme with no year in its code is kept, not hidden: it goes under "other".
    const key: YearKey = programmeYear(programme.code) ?? 'other'
    groups.set(key, [...(groups.get(key) ?? []), programme])
  }
  // Numbers ascending, then "other".
  const keys = [...groups.keys()].sort((a, b) => {
    if (a === 'other') return 1
    if (b === 'other') return -1
    return a - b
  })
  return { groups, keys }
}

/** The programme section. */
export function ProgrammePicker() {
  // The programmes, and the two changes.
  const programmes = useJoinableProgrammes()
  const request = useRequestProgramme()
  const cancel = useCancelProgrammeRequest()
  // The year the student chose, or null while they have not.
  const [chosen, setChosen] = useState<YearKey | null>(null)
  // True while either change runs, so a button can't be pressed twice.
  const busy = request.isPending || cancel.isPending

  // First load: a block where the list will be.
  if (programmes.isPending) {
    return <Skeleton className="h-20" aria-label="Loading programmes" />
  }
  // Failed: the message and a retry.
  if (programmes.isError) {
    return <LoadError error={programmes.error} onRetry={() => void programmes.refetch()} />
  }
  // Nothing open: say so, so the dialog is not an empty box.
  if (programmes.data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No programme is open to join yet. Ask your administrator.
      </p>
    )
  }

  // A student belongs to one programme, and only one request waits at a time: whichever applies is
  // the only thing shown, with no year to choose.
  const mine = programmes.data.find((programme) => programme.membership === 'enrolled')
  const waiting = programmes.data.find((programme) => programme.membership === 'pending')
  const fixed = mine ?? waiting
  // A refused request, shown with whatever step is on screen.
  const problem =
    request.isError || cancel.isError ? (
      <FormMessage tone="error">{joinMessage(request.error ?? cancel.error)}</FormMessage>
    ) : null

  /** Asks to join, or withdraws, for the rows below. */
  const rowActions = {
    busy,
    onAsk: (programmeId: string) => {
      request.mutate(programmeId)
    },
    onCancel: (requestId: string) => {
      cancel.mutate(requestId)
    },
  }

  if (fixed) {
    return (
      // min-w-0: a fieldset otherwise grows to its widest line and pushes the dialog off a phone.
      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-semibold">Choose your programme</legend>
        <p className="text-xs text-muted-foreground">
          {mine
            ? "You're in this programme. To change it, ask an administrator."
            : 'One request waits at a time. Cancel it to choose a different programme.'}
        </p>
        {problem}
        <ul className="space-y-2">
          <ProgrammeRow programme={fixed} {...rowActions} />
        </ul>
      </fieldset>
    )
  }

  const { groups, keys } = groupByYear(programmes.data)
  // The programmes of the chosen year; none until a year is chosen (or if it has since gone).
  const inYear = chosen === null ? undefined : groups.get(chosen)

  // Step one: the year.
  if (!inYear) {
    return (
      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-semibold">Choose your year</legend>
        <p className="text-xs text-muted-foreground">
          Pick the year you study in. You will then see the programmes of that year.
        </p>
        {problem}
        <div className="grid grid-cols-2 gap-2">
          {keys.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              className="h-auto min-h-11 whitespace-normal"
              onClick={() => {
                setChosen(key)
              }}
            >
              {key === 'other' ? 'Other programmes' : yearLabel(key)}
            </Button>
          ))}
        </div>
      </fieldset>
    )
  }

  // Step two: that year's programmes.
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold">Choose your programme</legend>
      <p className="text-xs text-muted-foreground">
        Ask to join the programme you study. Once an administrator approves, you are added to all of
        its courses.
      </p>
      <Button
        type="button"
        variant="link"
        className="h-auto p-0 text-xs"
        onClick={() => {
          setChosen(null)
        }}
      >
        Change year
      </Button>
      {problem}
      <ul className="space-y-2">
        {inYear.map((programme) => (
          <ProgrammeRow key={programme.id} programme={programme} {...rowActions} />
        ))}
      </ul>
    </fieldset>
  )
}

/** One programme, with its courses and the action its standing allows. */
function ProgrammeRow({
  programme,
  busy,
  onAsk,
  onCancel,
}: Readonly<{
  programme: JoinableProgramme
  busy: boolean
  onAsk: (programmeId: string) => void
  onCancel: (requestId: string) => void
}>) {
  const count = programme.courseCount
  const canAsk = programme.membership === 'none' || programme.membership === 'declined'
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
      {/* Full name first, then the code small, then the courses joining adds (D110). */}
      <div className="min-w-0">
        <p className="font-semibold break-words">{programme.name}</p>
        <p className="text-xs text-muted-foreground">{programme.code}</p>
        <p className="text-xs text-muted-foreground">
          {`${count} ${count === 1 ? 'course' : 'courses'}: ${programme.courseCodes.join(', ')}`}
        </p>
      </div>
      {/* The standing and its action. The words carry the meaning, not colour. */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        {programme.membership === 'enrolled' && <Badge variant="success">Joined</Badge>}
        {programme.membership === 'pending' && (
          <>
            <Badge variant="warning">Requested</Badge>
            <Button
              type="button"
              variant="link"
              disabled={busy}
              aria-label={`Cancel request for ${programme.name}`}
              onClick={() => {
                if (programme.requestId !== null) onCancel(programme.requestId)
              }}
            >
              Cancel request
            </Button>
          </>
        )}
        {programme.membership === 'declined' && <Badge variant="destructive">Declined</Badge>}
        {canAsk && (
          <Button
            type="button"
            disabled={busy}
            aria-label={`${programme.membership === 'declined' ? 'Request again to join' : 'Request to join'} ${programme.name}`}
            onClick={() => {
              onAsk(programme.id)
            }}
          >
            {programme.membership === 'declined' ? 'Request again' : 'Request to join'}
          </Button>
        )}
      </div>
    </li>
  )
}
