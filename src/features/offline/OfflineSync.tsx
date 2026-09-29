/**
 * Keeps the signed-in student's notes on the device, so notes they have opened read offline
 * (FR-PWA-8). Restores the saved copy when a student is signed in, then saves changes. The copy
 * belongs to one student: another student's copy is never loaded. Sign-out deletes it (AuthProvider).
 */

// Access to the query cache.
import { useQueryClient } from '@tanstack/react-query'
// Saving and restoring the cache.
import { persistQueryClient, persistQueryClientSave } from '@tanstack/react-query-persist-client'
// Runs the sync while a student is signed in.
import { useEffect, useState } from 'react'

// Sign-in state, for the student's ID.
import { useAuth } from '@/features/auth/useAuth'
// Which data is kept, and for how long.
import { OFFLINE_MAX_AGE_MS, shouldKeepOffline } from '@/lib/offlineCache'
// Reports failures.
import { reportError } from '@/lib/reportError'

// The IndexedDB store and the throttled persister.
import { createIdbStore, type KeyValueStore } from './idbStore'
import { createThrottledPersister } from './throttledPersister'

/** The key the cache is saved under. */
export const OFFLINE_CACHE_KEY = 'query-cache'

/** Renders nothing; runs the sync for the signed-in student. `store` is replaceable for tests. */
export function OfflineSync({ store: givenStore }: Readonly<{ store?: KeyValueStore }>) {
  // The cache.
  const queryClient = useQueryClient()
  // The signed-in student's ID, or null.
  const auth = useAuth()
  const studentId = auth.status === 'signedIn' ? auth.session.user.id : null
  // The store, created once.
  const [store] = useState(() => givenStore ?? createIdbStore())

  useEffect(() => {
    // Nobody signed in: nothing to restore or save.
    if (!studentId) return
    // A fresh persister per student.
    const persister = createThrottledPersister(store, OFFLINE_CACHE_KEY)
    // Restore, then keep saving. SECURITY: the student's ID is the "buster", so a copy saved
    // for anyone else is discarded instead of shown (a shared computer where the last student's
    // session simply expired).
    const options = {
      queryClient,
      persister,
      buster: studentId,
      dehydrateOptions: { shouldDehydrateQuery: shouldKeepOffline },
    }
    const [unsubscribe, restored] = persistQueryClient({ ...options, maxAge: OFFLINE_MAX_AGE_MS })
    restored
      // Saving only starts after the restore, so save once now: data that loaded in the
      // meantime would otherwise wait for the next change.
      .then(async () => {
        // The copy can be older than the server's data (it is written after a pause), so mark
        // it stale: shown at once, refetched whenever the device is online. Offline, the copy
        // stays on screen, because paused fetches keep their data.
        await queryClient.invalidateQueries({ predicate: shouldKeepOffline })
        await persistQueryClientSave(options)
      })
      // A failure only means nothing is available offline this time.
      .catch((error: unknown) => {
        reportError(error, { where: 'OfflineSync.restore' })
      })
    // Signed out or switched student: stop saving, and drop a write still waiting.
    return () => {
      unsubscribe()
      persister.cancel()
    }
  }, [queryClient, store, studentId])

  // Nothing to show.
  return null
}
