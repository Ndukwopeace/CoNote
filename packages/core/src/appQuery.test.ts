/**
 * Tests for the query-function wrapper that turns any failure into an AppError.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The error type it produces.
import { AppError } from './errors'

// The unit under test.
import { appQuery } from './appQuery'

describe('appQuery', () => {
  // Proves a successful load passes its value through unchanged.
  it('returns the loaded value', async () => {
    await expect(appQuery(() => Promise.resolve(42))).resolves.toBe(42)
  })

  // Proves an AppError passes through as it is.
  it('keeps an AppError', async () => {
    // Arrange.
    const error = new AppError('not_found', 'Missing')

    // Act and assert.
    await expect(appQuery(() => Promise.reject(error))).rejects.toBe(error)
  })

  // Proves anything else becomes an AppError, keeping the original only as its cause.
  it('wraps other failures', async () => {
    // Arrange.
    const raw = new Error('SQL: select * from notes')

    // Act.
    const result = appQuery(() => Promise.reject(raw))

    // Assert.
    await expect(result).rejects.toBeInstanceOf(AppError)
    await expect(result).rejects.toMatchObject({ kind: 'unknown', cause: raw })
  })
})
