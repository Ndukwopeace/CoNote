/**
 * "Join your programme" (D105), the top of the join dialog: the programmes an administrator has
 * opened, each with the courses joining it adds. Joining enrols the student at once, because the
 * administrator set the programme up; single courses below still need approval.
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
import { useJoinableProgrammes, useJoinProgramme } from '@/hooks/useEnrolment'
// Words for a refused join.
import { joinMessage } from './joinMessage'
// Shapes.
import type { JoinableProgramme } from '@/types/domain'

/** The programme section. */
export function ProgrammePicker() {
  // The programmes, and the join.
  const programmes = useJoinableProgrammes()
  const join = useJoinProgramme()

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

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">Join your programme</legend>
      <p className="text-xs text-muted-foreground">
        Join the year you study in and you are added to all of its courses.
      </p>
      {/* A refused join. */}
      {join.isError && <FormMessage tone="error">{joinMessage(join.error)}</FormMessage>}
      <ul className="space-y-2">
        {programmes.data.map((programme) => (
          <ProgrammeRow
            key={programme.id}
            programme={programme}
            busy={join.isPending}
            onJoin={() => {
              join.mutate(programme.id)
            }}
          />
        ))}
      </ul>
    </fieldset>
  )
}

/** One programme, with its courses and the join button. */
function ProgrammeRow({
  programme,
  busy,
  onJoin,
}: Readonly<{ programme: JoinableProgramme; busy: boolean; onJoin: () => void }>) {
  const count = programme.courseCount
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
      {/* Code, name and the courses joining adds. */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-primary-dark">{programme.code}</p>
        <p className="truncate font-medium">{programme.name}</p>
        <p className="text-xs text-muted-foreground">
          {`${count} ${count === 1 ? 'course' : 'courses'}: ${programme.courseCodes.join(', ')}`}
        </p>
      </div>
      {/* The standing: joined, or the button. The words carry the meaning, not colour. */}
      {programme.isMine ? (
        <Badge variant="success">Joined</Badge>
      ) : (
        <Button
          type="button"
          disabled={busy}
          aria-label={`Join ${programme.code}`}
          onClick={onJoin}
        >
          Join programme
        </Button>
      )}
    </li>
  )
}
