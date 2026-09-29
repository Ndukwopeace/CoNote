/**
 * Global search in the top bar (REQUIREMENTS.md section 8): courses, classes and note titles,
 * grouped by type in a drop-down. Built as an ARIA combobox: arrow keys move through the results,
 * Enter opens one, Escape closes the list.
 */

// Icons.
import { Search, X } from 'lucide-react'
// Input text, open state, the active result and the input element.
import { useId, useRef, useState } from 'react'
// Opens a result.
import { useNavigate } from 'react-router'

// Text input.
import { Input } from '@/components/ui/input'
// Data hooks.
import { useMyClasses } from '@/hooks/useClasses'
import { useMyCourses } from '@/hooks/useCourses'
import { useMyNotes } from '@/hooks/useNotes'
// Link builders.
import { routeTo } from '@/lib/routes'
// Matching rules.
import { MIN_QUERY_LENGTH, searchAll } from '@/lib/search'
// Class-name helper.
import { cn } from '@/lib/utils'

/** One result, ready to show and open. */
interface Option {
  // Unique within the list, and the element's ID suffix.
  key: string
  // The main text.
  label: string
  // A second, quieter line.
  detail: string
  // Where it opens.
  to: string
}

/** The search box and its results. */
export function GlobalSearch() {
  // The lists searched; already cached by the pages that use them.
  const courses = useMyCourses()
  const classes = useMyClasses()
  const notes = useMyNotes()
  // Opens a result.
  const navigate = useNavigate()
  // What is typed.
  const [query, setQuery] = useState('')
  // Whether the results are showing.
  const [open, setOpen] = useState(false)
  // The highlighted result, as an index into `options`; -1 for none.
  const [active, setActive] = useState(-1)
  // The input, to return focus after clearing.
  const input = useRef<HTMLInputElement>(null)
  // IDs for the ARIA wiring.
  const listId = useId()

  // The matches, grouped, then flattened for the keyboard.
  const results = searchAll(
    { courses: courses.data ?? [], classes: classes.data ?? [], notes: notes.data ?? [] },
    query,
  )
  // Course code by ID, for class details.
  const codeOf = new Map((courses.data ?? []).map((c) => [c.id, c.code]))
  const groups: { name: string; options: Option[] }[] = [
    {
      name: 'Courses',
      options: results.courses.map((c) => ({
        key: `course-${c.id}`,
        label: `${c.code} · ${c.title}`,
        detail: c.teacher.fullName,
        to: routeTo.course(c.id),
      })),
    },
    {
      name: 'Classes',
      options: results.classes.map((c) => ({
        key: `class-${c.id}`,
        label: c.title,
        detail: `${codeOf.get(c.courseId) ?? ''} · Class ${String(c.number)}`,
        to: routeTo.class(c.courseId, c.id),
      })),
    },
    {
      name: 'Notes',
      options: results.notes.map((n) => ({
        key: `note-${n.id}`,
        label: n.title ?? 'Untitled note',
        detail: codeOf.get(n.courseId) ?? '',
        to: routeTo.note(n.id),
      })),
    },
  ].filter((group) => group.options.length > 0)
  const options = groups.flatMap((group) => group.options)
  // Whether the query is long enough to search.
  const searching = query.trim().length >= MIN_QUERY_LENGTH
  // The list shows only while open and searching.
  const expanded = open && searching
  // The element ID of an option.
  const optionId = (option: Option) => `${listId}-${option.key}`

  /** Opens a result and resets the box. */
  function go(option: Option) {
    setQuery('')
    setOpen(false)
    setActive(-1)
    void navigate(option.to)
  }

  return (
    <div className="relative max-w-md flex-1">
      {/* Magnifying glass inside the field; decorative, and ignores clicks. */}
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      {/* The combobox. aria-label names it because there is no visible label. */}
      <Input
        ref={input}
        type="search"
        role="combobox"
        aria-label="Search courses, classes and notes"
        aria-expanded={expanded && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        {...(expanded && active >= 0 && options[active]
          ? { 'aria-activedescendant': optionId(options[active]) }
          : {})}
        // Says what can be found (recognition over recall); fits phones from 360 px (D35).
        placeholder="Find courses & notes"
        value={query}
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => {
          setOpen(true)
        }}
        // Closing on blur; results keep focus in the box with onMouseDown below.
        onBlur={() => {
          setOpen(false)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            // Move through the results, wrapping at the ends.
            event.preventDefault()
            setOpen(true)
            if (options.length === 0) return
            const step = event.key === 'ArrowDown' ? 1 : -1
            setActive((current) => (current + step + options.length) % options.length)
          } else if (event.key === 'Enter' && expanded && options[active]) {
            // Open the highlighted result.
            event.preventDefault()
            go(options[active])
          } else if (event.key === 'Escape') {
            // Close the list; the text stays.
            setOpen(false)
            setActive(-1)
          }
        }}
        // Room for the icon and the clear button; the browser's own clear button is hidden (D35).
        className="pr-9 pl-9 text-ellipsis [&::-webkit-search-cancel-button]:appearance-none"
      />
      {/* Clear, when there is text. */}
      {query !== '' && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQuery('')
            setActive(-1)
            input.current?.focus()
          }}
          className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}

      {/* The results, grouped. Nothing matching gets a sentence instead of an empty list. */}
      {expanded &&
        (options.length > 0 ? (
          <div
            id={listId}
            role="listbox"
            aria-label="Search results"
            className="absolute inset-x-0 top-full z-40 mt-1 max-h-96 overflow-y-auto rounded-lg border bg-card py-1 shadow-lg"
          >
            {groups.map((group) => (
              <div key={group.name} role="group" aria-label={group.name}>
                {/* The group's visible heading; the group's label gives it to screen readers. */}
                <div
                  aria-hidden="true"
                  className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground"
                >
                  {group.name}
                </div>
                {group.options.map((option) => {
                  // Whether this is the highlighted result.
                  const isActive = options[active]?.key === option.key
                  return (
                    // The combobox pattern: keys are handled on the input, which points at the
                    // highlighted option with aria-activedescendant, so options take no key
                    // events of their own and stay out of the Tab order (tabIndex -1).
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- see above
                    <div
                      key={option.key}
                      id={optionId(option)}
                      role="option"
                      tabIndex={-1}
                      aria-selected={isActive}
                      // Keep focus in the box, so blur doesn't close the list before the click.
                      onMouseDown={(event) => {
                        event.preventDefault()
                      }}
                      onClick={() => {
                        go(option)
                      }}
                      className={cn(
                        'cursor-pointer px-3 py-2 text-sm hover:bg-background',
                        isActive && 'bg-primary-light',
                      )}
                    >
                      <span className="block truncate font-medium">{option.label}</span>{' '}
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.detail}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ) : (
          <p className="absolute inset-x-0 top-full z-40 mt-1 rounded-lg border bg-card px-3 py-3 text-sm text-muted-foreground shadow-lg">
            No matches for “{query.trim()}”.
          </p>
        ))}
    </div>
  )
}
