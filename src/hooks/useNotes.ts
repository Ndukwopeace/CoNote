/**
 * Data hooks for the student's own notes. Reading only until M4.
 */

// Cached, deduplicated reads.
import { useQuery } from '@tanstack/react-query'

// The injected services and the filter type.
import type { NoteFilter } from '@/services/types'
import { useServices } from '@/services/useServices'

// Error conversion for query functions.
import { appQuery } from './appQuery'
// Cache keys.
import { queryKeys } from './queryKeys'

/** The student's notes, newest first, optionally for one course or class. */
export function useMyNotes(filter: NoteFilter = {}) {
  // The note service.
  const { notes } = useServices()
  // Cached list, one cache entry per filter.
  return useQuery({
    queryKey: queryKeys.notes.list(filter),
    queryFn: () => appQuery(() => notes.listMyNotes(filter)),
  })
}
