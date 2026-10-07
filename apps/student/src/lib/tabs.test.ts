/**
 * Tests for reading a tab name from the address (?tab=).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The parser under test.
import { parseTab } from './tabs'

/** A sample tab list. */
const TABS: ['overview', 'classes', 'notes'] = ['overview', 'classes', 'notes']

describe('parseTab', () => {
  // Proves a known tab is kept.
  it('keeps a known tab', () => {
    // Assert.
    expect(parseTab('notes', TABS)).toBe('notes')
  })

  // SECURITY: proves a crafted or stale value falls back to the first tab.
  it.each([null, '', 'NOTES', 'settings', '<script>'])(
    'falls back to the first tab for %j',
    (value) => {
      // Assert.
      expect(parseTab(value, TABS)).toBe('overview')
    },
  )
})
