/**
 * Reading one note, and creating, editing and deleting notes (FR-NTE). Edits and deletes are
 * optimistic: the screen changes at once and goes back if the service fails (section 11).
 * Pages show the success and failure messages; these hooks only look after the cache.
 */

// Cached reads and writes, and the cache itself.
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

// What a student submits for a note.
import type { NoteInput } from '@/lib/notes'
// The injected services.
import { useServices } from '@/services/useServices'
// Shapes.
import type { ID, Note } from '@/types/domain'

// Error conversion for query functions.
import { appQuery } from './appQuery'
// Cache keys.
import { queryKeys } from './queryKeys'

/** Every cached note entry (lists and single notes) as it was, so it can be put back. */
type NoteSnapshot = [readonly unknown[], unknown][]

/** Takes a copy of every cached note entry, after stopping refetches that could overwrite them. */
async function snapshotNotes(client: QueryClient): Promise<NoteSnapshot> {
  // A refetch finishing mid-edit would replace the optimistic change with old data.
  await client.cancelQueries({ queryKey: queryKeys.notes.all })
  // Keys with their current data.
  return client.getQueriesData({ queryKey: queryKeys.notes.all })
}

/** Puts every cached note entry back as it was. */
function restoreNotes(client: QueryClient, snapshot: NoteSnapshot | undefined) {
  // Each saved entry, written back as it was.
  for (const [key, data] of snapshot ?? []) client.setQueryData(key, data)
}

/**
 * Applies `change` to every cached note: each list is mapped (a null result drops the note), and
 * each single note is replaced.
 */
function changeCachedNotes(client: QueryClient, change: (note: Note) => Note | null) {
  // Every note entry in the cache.
  for (const [key, data] of client.getQueriesData<Note | Note[]>({
    queryKey: queryKeys.notes.all,
  })) {
    // A list: change each note, dropping the removed ones.
    if (Array.isArray(data)) {
      client.setQueryData<Note[]>(
        key,
        data.map(change).filter((note): note is Note => note !== null),
      )
    } else if (data) {
      // A single note: replace it (a removed note stays until the page leaves; it is gone
      // from every list already).
      const changed = change(data)
      if (changed) client.setQueryData<Note>(key, changed)
    }
  }
}

/** One note; fails with a not_found AppError for an unknown or someone else's note. */
export function useNote(noteId: ID) {
  // The note service.
  const { notes } = useServices()
  // Cached note.
  return useQuery({
    queryKey: queryKeys.notes.detail(noteId),
    queryFn: () => appQuery(() => notes.getNote(noteId)),
  })
}

/** Creates a note. Not optimistic: the page waits for the saved note before moving on. */
export function useCreateNote() {
  // The note service and the cache.
  const { notes } = useServices()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: NoteInput) => appQuery(() => notes.createNote(input)),
    // Saved: seed its own entry, and refresh the lists so it shows in each.
    onSuccess: async (note) => {
      client.setQueryData(queryKeys.notes.detail(note.id), note)
      await client.invalidateQueries({ queryKey: queryKeys.notes.all })
    },
  })
}

/** Edits a note, showing the change at once and undoing it if saving fails. */
export function useUpdateNote() {
  // The note service and the cache.
  const { notes } = useServices()
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, input }: { noteId: ID; input: NoteInput }) =>
      appQuery(() => notes.updateNote(noteId, input)),
    // Before the call: remember the cache, then show the edit.
    onMutate: async ({ noteId, input }) => {
      const snapshot = await snapshotNotes(client)
      // The typed values replace the old ones; the service's answer corrects anything else.
      changeCachedNotes(client, (note) =>
        note.id === noteId
          ? {
              ...note,
              // A blank title is resolved by the service; until then the old one stays.
              ...(input.title ? { title: input.title } : {}),
              contentHtml: input.contentHtml,
              tags: input.tags,
              classId: input.classId,
            }
          : note,
      )
      // Handed to onError.
      return { snapshot }
    },
    // Failed: put everything back.
    onError: (_error, _variables, context) => {
      restoreNotes(client, context?.snapshot)
    },
    // Either way: refetch, so the cache matches the service.
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notes.all }),
  })
}

/** Deletes a note, removing it at once and bringing it back if the delete fails. */
export function useDeleteNote() {
  // The note service and the cache.
  const { notes } = useServices()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (noteId: ID) => appQuery(() => notes.deleteNote(noteId)),
    // Before the call: remember the cache, then drop the note from every list.
    onMutate: async (noteId) => {
      const snapshot = await snapshotNotes(client)
      changeCachedNotes(client, (note) => (note.id === noteId ? null : note))
      // Handed to onError.
      return { snapshot }
    },
    // Failed: put everything back.
    onError: (_error, _noteId, context) => {
      restoreNotes(client, context?.snapshot)
    },
    // Deleted: forget its own entry so nothing reads a deleted note from the cache.
    onSuccess: (_result, noteId) => {
      client.removeQueries({ queryKey: queryKeys.notes.detail(noteId) })
    },
    // Either way: refetch the lists.
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notes.all }),
  })
}
