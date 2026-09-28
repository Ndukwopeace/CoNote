import { describe, expect, it, vi } from 'vitest'

import { createErrorReporter } from './reportError'

describe('createErrorReporter', () => {
  it('logs errors with their context in development', () => {
    const log = vi.fn()
    const report = createErrorReporter({ isDev: true, log })
    const error = new Error('boom')

    report(error, { where: 'NotesPage' })

    expect(log).toHaveBeenCalledWith('[CoNote]', error, { where: 'NotesPage' })
  })

  it('stays silent in production until an error tracker is connected', () => {
    const log = vi.fn()
    const report = createErrorReporter({ isDev: false, log })

    report(new Error('boom'))

    expect(log).not.toHaveBeenCalled()
  })
})
