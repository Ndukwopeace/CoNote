/**
 * Layout stand-ins for tests that click inside the note editor. jsdom has no layout, so it
 * leaves out the hit-testing and measuring calls ProseMirror makes on clicks.
 *
 * Installed only where needed: once elementFromPoint exists, axe runs visibility checks it
 * otherwise skips in jsdom, which would change what other tests' accessibility checks mean.
 */

// Hooks that run around a test file.
import { afterAll, beforeAll } from 'vitest'

/** Adds the stand-ins before the file's tests and removes them afterwards. */
export function installEditorDomStubs() {
  // The originals (undefined in jsdom), to put back.
  const original = {
    elementFromPoint: Object.getOwnPropertyDescriptor(Document.prototype, 'elementFromPoint'),
    getClientRects: Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects'),
    getBoundingClientRect: Object.getOwnPropertyDescriptor(
      Range.prototype,
      'getBoundingClientRect',
    ),
  }

  beforeAll(() => {
    // "Nothing there" and "no size".
    Object.defineProperty(Document.prototype, 'elementFromPoint', {
      configurable: true,
      value: () => null,
    })
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => document.createElement('div').getClientRects(),
    })
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(),
    })
  })

  afterAll(() => {
    // Put each back, or remove it if jsdom never had it.
    for (const [key, target] of [
      ['elementFromPoint', Document.prototype],
      ['getClientRects', Range.prototype],
      ['getBoundingClientRect', Range.prototype],
    ] as const) {
      const descriptor = original[key]
      if (descriptor) Object.defineProperty(target, key, descriptor)
      else Reflect.deleteProperty(target, key)
    }
  })
}
