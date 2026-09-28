/**
 * Tests for the one-off notices passed to the sign-in page through navigation state.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The helpers under test.
import { authNoticeState, readAuthNotice } from './authNotice'

describe('readAuthNotice', () => {
  // Proves a notice written by authNoticeState reads back as its fixed message.
  it('reads back the message for a known notice', () => {
    expect(readAuthNotice(authNoticeState('passwordUpdated'))).toBe(
      'Your password has been updated. Sign in with your new password.',
    )
  })

  // SECURITY: proves only known notices are shown. Navigation state can be set by any script on
  // the page, so free text in it must never reach the screen (content injection).
  it.each([
    [null],
    [undefined],
    ['passwordUpdated'],
    [{ notice: 'Your account is locked. Call 555-0100.' }],
    [{ notice: 'toString' }],
    [{ notice: 42 }],
  ])('ignores the state %j', (state) => {
    expect(readAuthNotice(state)).toBeNull()
  })
})
