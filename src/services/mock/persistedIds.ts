/**
 * A set of IDs the demo remembers between reloads, such as viewed summaries or read
 * notifications. Kept under the mock-data prefix, so sign-out leaves it (it stands in for the
 * server).
 */

// Checks stored values before use.
import { z } from 'zod'

/** The part of Storage the set uses. */
export interface DemoStore {
  // Reads a value.
  getItem(key: string): string | null
  // Writes a value.
  setItem(key: string, value: string): void
}

/**
 * The stored shape.
 * SECURITY: storage can be edited in developer tools; anything but a list of strings is ignored.
 */
const idsSchema = z.array(z.string())

/** A set of IDs, starting from `initial`, saved to `store` under `key` after each change. */
export function createPersistedIdSet(
  initial: Iterable<string>,
  store: DemoStore | undefined,
  key: string,
) {
  /** Reads the saved IDs, or null when there are none or they are unusable. */
  function read(): string[] | null {
    if (!store) return null
    try {
      const raw = store.getItem(key)
      if (raw === null) return null
      const parsed = idsSchema.safeParse(JSON.parse(raw))
      return parsed.success ? parsed.data : null
    } catch {
      // Blocked storage or broken JSON: start from `initial`.
      return null
    }
  }

  // The working set.
  const ids = new Set(read() ?? initial)

  /** Writes the set back; blocked storage keeps the change until reload. */
  function save() {
    try {
      store?.setItem(key, JSON.stringify([...ids]))
    } catch {
      // Nothing more to do.
    }
  }

  return {
    // Whether an ID is in the set.
    has: (id: string) => ids.has(id),
    // Adds IDs and saves.
    add: (...added: string[]) => {
      for (const id of added) ids.add(id)
      save()
    },
  }
}
