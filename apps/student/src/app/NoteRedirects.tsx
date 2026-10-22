/**
 * Old note addresses, kept so a bookmark or an old link still lands somewhere useful (D109):
 * notes are written and edited in the chat on Home now, so these send the student there.
 */

// Redirects, and the address's parts.
import { Navigate, useParams, useSearchParams } from 'react-router'

// Home's addresses.
import { ROUTES, routeTo } from '@/lib/routes'

/** /notes/new[?classId=] → the chat with the composer ready, for that class when one is named. */
export function NewNoteRedirect() {
  // The class named by the old address, if any.
  const [params] = useSearchParams()
  const classId = params.get('classId')
  // SECURITY: the ID is encoded again when the new address is built, so it cannot add parameters.
  return <Navigate replace to={classId ? routeTo.newNote(classId) : ROUTES.newNote} />
}

/** /notes/:noteId/edit → that note, open in the chat's composer. */
export function EditNoteRedirect() {
  // The note named by the old address.
  const { noteId = '' } = useParams()
  // SECURITY: encoded when the new address is built, so it cannot add parameters.
  return <Navigate replace to={routeTo.editNote(noteId)} />
}
