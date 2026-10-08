/**
 * Tests for one-off notices passed between pages in navigation state.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { createNavigationNotices } from './navigationNotice'

// A small set of notices, as an app would define them.
const notices = createNavigationNotices({ saved: 'Your changes were saved.' })

describe('createNavigationNotices', () => {
  // Proves a notice survives the trip through navigation state.
  it('reads back the message for a known notice', () => {
    expect(notices.read(notices.stateFor('saved'))).toBe('Your changes were saved.')
  })

  // Proves there is nothing to show without a notice.
  it.each([undefined, null, 'saved', {}, { notice: 42 }])('ignores %j', (state) => {
    expect(notices.read(state)).toBeNull()
  })

  // SECURITY: proves text injected into navigation state is never shown; only known keys work.
  it('ignores unknown keys and raw text', () => {
    expect(notices.read({ notice: 'You have been hacked' })).toBeNull()
    expect(notices.read({ notice: 'toString' })).toBeNull()
  })
})
