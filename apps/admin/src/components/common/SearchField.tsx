/**
 * The console's search box: it searches once typing pauses, so each key press doesn't start a
 * search, and it follows the address when the search changes elsewhere (Clear filters, Back).
 */

// The search icon.
import { Search } from 'lucide-react'
// The text while typing, and the pause before searching.
import { useEffect, useState } from 'react'

// The text input.
import { Input } from '@conote/ui/input'

/** How long typing must pause before the search runs. */
const SEARCH_DELAY_MS = 300

/** What the box searches, and how. */
interface SearchFieldProps {
  // Names the box for screen readers, e.g. "Search users".
  label: string
  placeholder: string
  // The search in the address, or undefined for none.
  value: string | undefined
  // Runs the search; undefined clears it.
  onSearch: (query: string | undefined) => void
}

/** The search box. */
export function SearchField({ label, placeholder, value, onSearch }: Readonly<SearchFieldProps>) {
  // The box's text, which runs the search after a pause.
  const [text, setText] = useState(value ?? '')
  // The address's search when the box last followed it.
  const [followed, setFollowed] = useState(value)
  // Follow the address when it changes elsewhere, while rendering.
  if (value !== followed) {
    setFollowed(value)
    setText(value ?? '')
  }

  // Search once typing pauses, unless the text already matches the address.
  useEffect(() => {
    // Nothing new to search for.
    if (text.trim() === (value ?? '')) return
    // Wait for the pause, then search.
    const timer = setTimeout(() => {
      onSearch(text.trim() || undefined)
    }, SEARCH_DELAY_MS)
    // A new key press restarts the wait.
    return () => {
      clearTimeout(timer)
    }
  }, [text, value, onSearch])

  return (
    <div className="relative min-w-56 flex-1">
      {/* Decorative icon inside the box. */}
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
        }}
        className="pl-9"
      />
    </div>
  )
}
