/**
 * Tests for keeping the signed-in student's notes on the device (FR-PWA-8): restore on start,
 * only for the same student, and saving after changes.
 */

// The cache and its snapshot format.
import { dehydrate, QueryClient } from '@tanstack/react-query'
// Rendering and waiting.
import { render, waitFor } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The real providers.
import { AppProviders } from '@/app/AppProviders'
// Storage key builder, to pre-seed a session.
import { storageKey } from '@/lib/storage'
// Factories.
import { makeNote, makeSession } from '@/test/factories'
// Demo services and a test cache.
import { createTestQueryClient, createTestServices } from '@/test/renderWithRouter'

// The unit under test and its key.
import { OFFLINE_CACHE_KEY, OfflineSync } from './OfflineSync'

/** An in-memory key-value store. */
function memoryStore() {
  const data = new Map<string, unknown>()
  return {
    data,
    get: (key: string) => Promise.resolve(data.get(key)),
    set: (key: string, value: unknown) => {
      data.set(key, value)
      return Promise.resolve()
    },
    del: (key: string) => {
      data.delete(key)
      return Promise.resolve()
    },
  }
}

/** A saved cache holding one note, belonging to `owner`. */
function savedCache(owner: string) {
  // A throwaway cache to snapshot.
  const source = new QueryClient()
  source.setQueryData(
    ['notes', 'detail', 'note-9'],
    makeNote({ id: 'note-9', title: 'Kept offline' }),
  )
  return { timestamp: Date.now(), buster: owner, clientState: dehydrate(source) }
}

/** Renders the sync for a signed-in student with the given store. */
function renderSync(store: ReturnType<typeof memoryStore>) {
  // Signed in as student-1.
  window.sessionStorage.setItem(
    storageKey('session'),
    JSON.stringify(makeSession({ id: 'student-1' })),
  )
  const queryClient = createTestQueryClient()
  render(
    <AppProviders services={createTestServices()} queryClient={queryClient}>
      <OfflineSync store={store} />
    </AppProviders>,
  )
  return queryClient
}

describe('OfflineSync', () => {
  // Proves the student's saved notes come back into the cache, so they read offline.
  it("restores the student's saved notes", async () => {
    // Arrange.
    const store = memoryStore()
    store.data.set(OFFLINE_CACHE_KEY, savedCache('student-1'))

    // Act.
    const queryClient = renderSync(store)

    // Assert.
    await waitFor(() => {
      expect(queryClient.getQueryData(['notes', 'detail', 'note-9'])).toMatchObject({
        title: 'Kept offline',
      })
    })
    // The copy may be older than the server's data, so it is marked for refetching when online.
    await waitFor(() => {
      expect(queryClient.getQueryState(['notes', 'detail', 'note-9'])?.isInvalidated).toBe(true)
    })
  })

  // SECURITY: proves another student's saved cache is never loaded, and is thrown away.
  it("ignores another student's saved notes", async () => {
    // Arrange.
    const store = memoryStore()
    store.data.set(OFFLINE_CACHE_KEY, savedCache('someone-else'))

    // Act.
    const queryClient = renderSync(store)

    // Assert.
    await waitFor(() => {
      expect(store.data.has(OFFLINE_CACHE_KEY)).toBe(false)
    })
    expect(queryClient.getQueryData(['notes', 'detail', 'note-9'])).toBeUndefined()
  })

  // Proves loaded notes are saved for next time, and other data isn't.
  it('saves notes after they load', async () => {
    // Arrange.
    const store = memoryStore()
    const queryClient = renderSync(store)

    // Act: a note and a notification list arrive.
    queryClient.setQueryData(['notes', 'list', {}], [makeNote()])
    queryClient.setQueryData(['notifications', 'list'], [])

    // Assert: written after the pause, notes only.
    await waitFor(
      () => {
        const saved = store.data.get(OFFLINE_CACHE_KEY) as
          { clientState: { queries: { queryKey: unknown[] }[] } } | undefined
        expect(saved?.clientState.queries.map((q) => q.queryKey[0])).toEqual(['notes'])
      },
      // The write waits for a 1-second pause; allow for a busy test machine.
      { timeout: 8000 },
    )
  }, 10_000)
})
