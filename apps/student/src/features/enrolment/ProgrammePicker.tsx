/**
 * "Join programme" (D105, D106), the top of the join dialog: the programmes an administrator has
 * opened, each with the courses joining it adds. A student asks, an administrator approves, and
 * only then are the courses added. A student belongs to one programme, so once they are in one it
 * is the only one shown, and while a request waits no other can be asked for.
 */

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
// Words for a refused request.
import { joinMessage } from './joinMessage'
// Shapes.
import type { JoinableProgramme } from '@/types/domain'

/** The programme section. */
export function ProgrammePicker() {
  // The programmes, and the two changes.
  const programmes = useJoinableProgrammes()
  const request = useRequestProgramme()
  const cancel = useCancelProgrammeRequest()
  // True while either change runs, so a button can't be pressed twice.
  const busy = request.isPending || cancel.isPending

  // First load: a block where the list will be.
  if (programmes.isPending) {
    return <Skeleton className="h-20" aria-label="Loading programmes" />
  }
  // Failed: the message and a retry; the courses below still work.
  if (programmes.isError) {
    return <LoadError error={programmes.error} onRetry={() => void programmes.refetch()} />
  }
  // Nothing open: the section is left out, and the course search below is the way in.
  if (programmes.data.length === 0) return null

  // A student belongs to one programme: once in one, it is the only one shown.
  const mine = programmes.data.find((programme) => programme.membership === 'enrolled')
  const shown = mine ? [mine] : programmes.data
  // One request waits at a time, so the others wait their turn.
  const waiting = programmes.data.some((programme) => programme.membership === 'pending')

  return (
    // min-w-0: a fieldset otherwise grows to its widest line and pushes the dialog off a phone.
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold">Choose your programme</legend>
      <p className="text-xs text-muted-foreground">
        {mine
          ? "You're in this programme. To change it, ask an administrator."
          : 'Ask to join the year you study in. Once an administrator approves, you are added to all of its courses.'}
      </p>
      {waiting && (
        <p className="text-xs text-muted-foreground">
          One request waits at a time. Cancel it to ask for a different programme.
        </p>
      )}
      {/* A refused request. */}
      {(request.isError || cancel.isError) && (
        <FormMessage tone="error">{joinMessage(request.error ?? cancel.error)}</FormMessage>
      )}
      <ul className="space-y-2">
        {shown.map((programme) => (
          <ProgrammeRow
            key={programme.id}
            programme={programme}
            busy={busy}
            othersWaiting={waiting && programme.membership !== 'pending'}
            onAsk={() => {
              request.mutate(programme.id)
            }}
            onCancel={(requestId) => {
              cancel.mutate(requestId)
            }}
          />
        ))}
      </ul>
    </fieldset>
  )
}

/** One programme, with its courses and the action its standing allows. */
function ProgrammeRow({
  programme,
  busy,
  othersWaiting,
  onAsk,
  onCancel,
}: Readonly<{
  programme: JoinableProgramme
  busy: boolean
  // True when a request for a different programme is waiting.
  othersWaiting: boolean
  onAsk: () => void
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
            disabled={busy || othersWaiting}
            aria-label={`${programme.membership === 'declined' ? 'Request again to join' : 'Request to join'} ${programme.name}`}
            onClick={onAsk}
          >
            {programme.membership === 'declined' ? 'Request again' : 'Request to join'}
          </Button>
        )}
      </div>
    </li>
  )
}
