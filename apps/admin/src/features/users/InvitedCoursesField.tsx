/**
 * The courses an invited teacher will teach (D116): a short checklist inside the invite dialog.
 * The choice is kept with the invitation and becomes the teacher's when they accept it, because a
 * course may only go to an active teacher. Only courses in use are offered, and a course that
 * already has a teacher moves to this one, which the words say.
 */

// The filter text.
import { useState } from 'react'

// The search box and the inline note.
import { Input } from '@conote/ui/input'
import { Skeleton } from '@conote/ui/skeleton'

// The courses in use.
import { useUserFilterOptions } from '@/hooks/useUsers'

/** What the field needs from the dialog. */
interface InvitedCoursesFieldProps {
  // The IDs ticked so far.
  selected: readonly string[]
  // Called with the new list whenever a box is ticked or cleared.
  onChange: (ids: string[]) => void
}

/** The checklist, with a box to narrow it. */
export function InvitedCoursesField({ selected, onChange }: Readonly<InvitedCoursesFieldProps>) {
  // The courses in use, and the text that narrows the list.
  const options = useUserFilterOptions()
  const [query, setQuery] = useState('')
  // The courses whose code or title contains the text, ignoring case. A ticked course stays ticked
  // while it is hidden, because the choice lives in `selected`, not in the boxes.
  const text = query.trim().toLowerCase()
  const shown = (options.data?.courses ?? []).filter(
    (course) =>
      text === '' ||
      course.code.toLowerCase().includes(text) ||
      course.title.toLowerCase().includes(text),
  )

  /** Ticks or clears one course. */
  function toggle(courseId: string, checked: boolean) {
    onChange(checked ? [...selected, courseId] : selected.filter((id) => id !== courseId))
  }

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">Courses they will teach (optional)</legend>
      <p className="text-xs text-muted-foreground">
        They become this teacher&apos;s when they first sign in. A course that already has a teacher
        moves to this one.
      </p>
      {options.isPending && <Skeleton className="h-20" aria-label="Loading courses" />}
      {options.isError && (
        <p className="text-xs text-muted-foreground">
          The courses could not be loaded. You can give courses later with Assign to course.
        </p>
      )}
      {options.data && (
        <>
          <Input
            type="search"
            aria-label="Find a course"
            placeholder="Code or title"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
          />
          <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
            {shown.length === 0 && (
              <li className="text-xs text-muted-foreground">No course matches.</li>
            )}
            {shown.map((course) => (
              <li key={course.id}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(course.id)}
                    onChange={(event) => {
                      toggle(course.id, event.target.checked)
                    }}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="font-medium">{course.code}</span>{' '}
                    <span className="break-words text-muted-foreground">{course.title}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </fieldset>
  )
}
