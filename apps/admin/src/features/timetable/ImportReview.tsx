/**
 * The second step of the timetable import (D105): what was found, for the administrator to check
 * before anything is created. Teachers are matched to accounts and can be changed; a preview says
 * how many programmes, courses and classes the import would add; nothing is saved until the
 * administrator presses Import.
 */

// Effects and memoised values.
import { useEffect, useMemo, useState } from 'react'

// Buttons and the error box.
import { Button } from '@conote/ui/button'
import { FormMessage } from '@conote/ui/forms/FormMessage'
import { NativeSelect } from '@conote/ui/native-select'
import { Skeleton } from '@conote/ui/skeleton'

// The table.
import { DataTable, type DataColumn } from '@/components/common/DataTable'
// The data and the changes.
import { useImportTimetable, usePreviewTimetable } from '@/hooks/useProgrammes'
// Administrator-facing error wording.
import { errorMessage } from '@/lib/errorMessages'
// Counts and slots in words.
import { countOf, describeSlots } from '@/lib/timetable/describe'
// The payload the services take.
import { toImportPayload } from '@/lib/timetable/payload'
// Suggesting teachers.
import { suggestTeacher, type TeacherAccount } from '@/lib/timetable/teachers'
// The term's dates.
import type { TermDates } from '@/lib/timetable/term'
// The plan's shapes.
import type {
  PageProblem,
  PlannedCourse,
  PlannedProgramme,
  TimetablePlan,
} from '@/lib/timetable/types'
// What an import did.
import type { ImportOutcome } from '@/types/programmes'

/** What the review needs. */
interface ImportReviewProps {
  plan: TimetablePlan
  // Pages that could not be read (the rest are in the plan).
  problems: PageProblem[]
  term: TermDates
  timezone: string
  // The active teachers to choose from.
  teachers: TeacherAccount[]
  // True when the teachers could not be loaded: the courses go without one.
  teachersFailed: boolean
  onBack: () => void
  onImported: (outcome: ImportOutcome) => void
}

/** What the courses' columns need to show and change each course's teacher. */
interface ColumnInput {
  teachers: TeacherAccount[]
  // The chosen teacher's ID for each course code.
  selected: Record<string, string | null>
  // The notes that came with each course's suggested teacher.
  suggestions: Map<string, ReturnType<typeof suggestTeacher>>
  onChoose: (code: string, teacherId: string | null) => void
}

/** The courses' columns: code, title, when it meets and who teaches it. */
function columnsFor({
  teachers,
  selected,
  suggestions,
  onChoose,
}: ColumnInput): DataColumn<PlannedCourse, never>[] {
  return [
    { heading: 'Code', cell: (course) => course.code },
    { heading: 'Title', cell: (course) => course.title },
    { heading: 'Weekly', cell: (course) => describeSlots(course.slots) },
    {
      heading: 'Teacher',
      cell: (course) => (
        <span className="min-w-0 space-y-1">
          <NativeSelect
            aria-label={`Teacher for ${course.code}`}
            value={selected[course.code] ?? ''}
            onChange={(event) => {
              onChoose(course.code, event.target.value || null)
            }}
          >
            <option value="">No teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName}
              </option>
            ))}
          </NativeSelect>
          {suggestions.get(course.code)?.notes.map((note) => (
            <span key={note} className="block text-xs text-muted-foreground">
              {note}
            </span>
          ))}
        </span>
      ),
    },
  ]
}

/** The review. */
export function ImportReview({
  plan,
  problems,
  term,
  timezone,
  teachers,
  teachersFailed,
  onBack,
  onImported,
}: Readonly<ImportReviewProps>) {
  // The teacher suggested for each course, worked out once; the administrator may change them.
  const suggestions = useMemo(
    () =>
      new Map(
        plan.courses.map((course) => [course.code, suggestTeacher(course.teacherNames, teachers)]),
      ),
    [plan, teachers],
  )
  const [selected, setSelected] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      plan.courses.map((course) => [course.code, suggestions.get(course.code)?.teacherId ?? null]),
    ),
  )
  // What the preview and the import send. The preview leaves teachers out: they change no count,
  // so changing one needs no new preview (which, on the real database, is a whole rolled-back run).
  const previewPayload = useMemo(
    () => toImportPayload(plan, term, {}, timezone),
    [plan, term, timezone],
  )
  const classCount = previewPayload.courses.reduce(
    (total, course) => total + course.sessions.length,
    0,
  )
  const preview = usePreviewTimetable()
  // `mutate` keeps its identity between renders, so the effect below runs once per payload.
  const { mutate: runPreview } = preview
  const importer = useImportTimetable()
  // Previews once when the review opens.
  useEffect(() => {
    runPreview(previewPayload)
  }, [runPreview, previewPayload])

  const courseColumns = columnsFor({
    teachers,
    selected,
    suggestions,
    onChoose: (code, teacherId) => {
      setSelected({ ...selected, [code]: teacherId })
    },
  })
  /** The programmes' columns. */
  const programmeColumns: DataColumn<PlannedProgramme, never>[] = [
    { heading: 'Code', cell: (programme) => programme.code },
    { heading: 'Name', cell: (programme) => programme.name },
    { heading: 'Courses', cell: (programme) => String(programme.courseCodes.length) },
  ]
  // How many courses the administrator has given a teacher.
  const chosenTeachers = Object.values(selected).filter((id) => id !== null).length

  /** The preview's sentence, or the state in its place. */
  function previewLine() {
    if (preview.isError) {
      return (
        <span>
          {errorMessage(preview.error)}{' '}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              runPreview(previewPayload)
            }}
          >
            Check again
          </Button>
        </span>
      )
    }
    if (!preview.data) return <Skeleton className="h-5 w-80" />
    const outcome = preview.data
    return (
      <span>
        This will create {countOf(outcome.programmesCreated, 'programme')},{' '}
        {countOf(outcome.coursesCreated, 'course')} and{' '}
        {countOf(outcome.classesCreated, 'class', 'classes')}.
        {outcome.coursesExisting > 0 &&
          ` ${countOf(outcome.coursesExisting, 'course')} already exist and keep their details.`}
        {outcome.classesSkipped > 0 &&
          ` ${countOf(outcome.classesSkipped, 'class', 'classes')} already exist and are left as they are.`}
        {chosenTeachers > 0 && ` You chose a teacher for ${countOf(chosenTeachers, 'course')}.`}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Review before importing</h2>
      {/* What was found. */}
      <ul aria-label="What was found" className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <li>{countOf(plan.programmes.length, 'programme')}</li>
        <li>{countOf(plan.courses.length, 'course')}</li>
        <li>{countOf(classCount, 'class', 'classes')}</li>
      </ul>
      {/* Pages that could not be read. */}
      {problems.length > 0 && (
        <section aria-labelledby="problems-heading" className="space-y-1">
          <h3 id="problems-heading" className="font-medium">
            Pages that could not be read
          </h3>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {problems.map((problem) => (
              <li key={problem.pageNumber}>
                Page {problem.pageNumber}: {problem.message}
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* Things worth a look. */}
      {plan.warnings.length > 0 && (
        <section aria-labelledby="warnings-heading" className="space-y-1">
          <h3 id="warnings-heading" className="font-medium">
            Worth a look
          </h3>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}
      {teachersFailed && (
        <FormMessage tone="error">
          The teachers could not be loaded, so the courses will be made without one.
        </FormMessage>
      )}
      {/* The programmes. */}
      <section aria-labelledby="programmes-heading" className="space-y-2">
        <h3 id="programmes-heading" className="font-medium">
          Programmes
        </h3>
        <DataTable
          label="Programmes"
          rows={plan.programmes}
          rowKey={(programme) => programme.code}
          columns={programmeColumns}
        />
      </section>
      {/* The courses, with their teachers. */}
      <section aria-labelledby="courses-heading" className="space-y-2">
        <h3 id="courses-heading" className="font-medium">
          Courses
        </h3>
        <DataTable
          label="Courses"
          rows={plan.courses}
          rowKey={(course) => course.code}
          columns={courseColumns}
        />
      </section>
      {/* Cells that were not courses. */}
      {plan.ignored.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Skipped cells</summary>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {plan.ignored.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </details>
      )}
      {/* What an import would do, announced when it arrives. */}
      <output aria-live="polite" className="block text-sm">
        {previewLine()}
      </output>
      {importer.isError && <FormMessage tone="error">{errorMessage(importer.error)}</FormMessage>}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          disabled={!preview.data || importer.isPending}
          onClick={() => {
            importer.mutate(toImportPayload(plan, term, selected, timezone), {
              onSuccess: onImported,
            })
          }}
        >
          {importer.isPending ? 'Importing…' : 'Import timetable'}
        </Button>
      </div>
    </div>
  )
}
