/**
 * Tests for checking the addresses a student adds as links in a note.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The function under test.
import { normalizeLink } from './links'

describe('normalizeLink', () => {
  // Proves ordinary web and email addresses are kept.
  it.each([
    ['https://example.com/page', 'https://example.com/page'],
    ['http://example.com', 'http://example.com'],
    ['mailto:teacher@example.com', 'mailto:teacher@example.com'],
    ['  example.com/notes  ', 'https://example.com/notes'],
  ])('accepts %j as %j', (raw, expected) => {
    expect(normalizeLink(raw)).toBe(expected)
  })

  // SECURITY: proves script and data addresses are refused, so a link can't run code.
  it.each([
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'data:text/html,<b>x</b>',
    'vbscript:x',
    '',
    '   ',
  ])('refuses %j', (raw) => {
    expect(normalizeLink(raw)).toBeNull()
  })
})
