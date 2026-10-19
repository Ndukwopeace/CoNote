/**
 * Tests for the words a failed programme change gets (D106).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared error type.
import { AppError } from '@conote/core/errors'

// The unit under test.
import { programmeMessage } from './programmeMessage'

describe('programmeMessage', () => {
  // Proves a refusal written for people is shown as it is.
  it.each(['validation', 'conflict', 'not_found'] as const)(
    'shows a %s in its own words',
    (kind) => {
      expect(programmeMessage(new AppError(kind, 'Say this.'))).toBe('Say this.')
    },
  )

  // SECURITY: proves an unknown failure's raw text is never shown.
  it('uses the standard wording for anything else', () => {
    const message = programmeMessage(new AppError('network', 'ECONNRESET at 10.0.0.1'))

    expect(message).not.toContain('ECONNRESET')
    expect(message.length).toBeGreaterThan(0)
  })

  // Proves a thrown value that is not an AppError is handled too.
  it('copes with a plain error', () => {
    expect(programmeMessage(new Error('boom'))).not.toContain('boom')
  })
})
