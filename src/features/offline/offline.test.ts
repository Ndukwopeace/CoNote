/**
 * Tests for the offline note store: the throttled persister and the IndexedDB store's fallback.
 */

// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// The units under test.
import { createIdbStore, OFFLINE_DB_NAME } from './idbStore'
import { clearOfflineData } from './clearOfflineData'
import { createThrottledPersister, PERSIST_DELAY_MS } from './throttledPersister'

/** An in-memory store that records calls. */
function memoryStore() {
  const data = new Map<string, unknown>()
  return {
    data,
    get: vi.fn((key: string) => Promise.resolve(data.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      data.set(key, value)
      return Promise.resolve()
    }),
    del: vi.fn((key: string) => {
      data.delete(key)
      return Promise.resolve()
    }),
  }
}

/** A saved cache. */
const CLIENT = { timestamp: 1, buster: 'student-1', clientState: { mutations: [], queries: [] } }

// Real timers and the real indexedDB again after each test.
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('createThrottledPersister', () => {
  // Proves bursts of cache changes write once, after a pause.
  it('writes once per pause', async () => {
    // Arrange.
    vi.useFakeTimers()
    const store = memoryStore()
    const persister = createThrottledPersister(store, 'cache')

    // Act: three changes in quick succession.
    await persister.persistClient(CLIENT)
    await persister.persistClient({ ...CLIENT, timestamp: 2 })
    await persister.persistClient({ ...CLIENT, timestamp: 3 })
    await vi.advanceTimersByTimeAsync(PERSIST_DELAY_MS)

    // Assert: one write, of the latest.
    expect(store.set).toHaveBeenCalledOnce()
    expect(store.data.get('cache')).toEqual({ ...CLIENT, timestamp: 3 })
  })

  // Proves reading back and removing.
  it('restores and removes', async () => {
    // Arrange.
    const store = memoryStore()
    store.data.set('cache', CLIENT)
    const persister = createThrottledPersister(store, 'cache')

    // Assert.
    await expect(persister.restoreClient()).resolves.toEqual(CLIENT)
    await persister.removeClient()
    expect(store.data.has('cache')).toBe(false)
  })

  // SECURITY: proves a write still waiting is dropped on cancel, so nothing is saved after
  // sign-out starts.
  it('drops a pending write on cancel', async () => {
    // Arrange.
    vi.useFakeTimers()
    const store = memoryStore()
    const persister = createThrottledPersister(store, 'cache')
    await persister.persistClient(CLIENT)

    // Act.
    persister.cancel()
    await vi.advanceTimersByTimeAsync(PERSIST_DELAY_MS)

    // Assert.
    expect(store.set).not.toHaveBeenCalled()
  })
})

describe('createIdbStore', () => {
  // Proves browsers without IndexedDB (and jsdom) still work: nothing is kept, nothing throws.
  it('does nothing without IndexedDB', async () => {
    // Arrange.
    vi.stubGlobal('indexedDB', undefined)
    const store = createIdbStore()

    // Assert.
    await expect(store.set('k', 1)).resolves.toBeUndefined()
    await expect(store.get('k')).resolves.toBeUndefined()
    await expect(store.del('k')).resolves.toBeUndefined()
  })
})

describe('clearOfflineData', () => {
  // SECURITY: proves sign-out deletes the whole offline database (FR-PWA-7).
  it('deletes the offline database', async () => {
    // Arrange: an IndexedDB whose delete succeeds at once.
    const deleteDatabase = vi.fn(() => {
      const request = {} as { onsuccess?: () => void }
      queueMicrotask(() => request.onsuccess?.())
      return request
    })
    vi.stubGlobal('indexedDB', { deleteDatabase })

    // Act.
    await clearOfflineData()

    // Assert.
    expect(deleteDatabase).toHaveBeenCalledWith(OFFLINE_DB_NAME)
  })

  // Proves sign-out still finishes without IndexedDB.
  it('resolves without IndexedDB', async () => {
    // Arrange.
    vi.stubGlobal('indexedDB', undefined)

    // Assert.
    await expect(clearOfflineData()).resolves.toBeUndefined()
  })
})
