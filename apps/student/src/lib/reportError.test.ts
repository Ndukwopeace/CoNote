/**
 * Tests for the error reporter.
 */

// Vitest building blocks; vi.fn records calls.
import { describe, expect, it, vi } from 'vitest'

// The factory under test (not the app-wide reporter, which writes to the real console).
import { createErrorReporter } from './reportError'

describe('createErrorReporter', () => {
  // Proves developers see errors and their context during development.
  it('logs errors with their context in development', () => {
    // Arrange: a recording logger and a development reporter.
    const log = vi.fn()
    const report = createErrorReporter({ isDev: true, log })
    const error = new Error('boom')

    // Act.
    report(error, { where: 'NotesPage' })

    // Assert: logged with a prefix, the error and the context.
    expect(log).toHaveBeenCalledWith('[CoNote]', error, { where: 'NotesPage' })
  })

  // SECURITY: proves production writes nothing to the console, where student data could be read.
  it('stays silent in production until an error tracker is connected', () => {
    // Arrange: a production reporter.
    const log = vi.fn()
    const report = createErrorReporter({ isDev: false, log })

    // Act.
    report(new Error('boom'))

    // Assert: nothing logged.
    expect(log).not.toHaveBeenCalled()
  })
})
