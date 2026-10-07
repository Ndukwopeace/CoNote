/**
 * Tests for the route builders and the settings-tab check.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The functions under test.
import { isSettingsTab, routeTo } from './routes'

describe('routeTo', () => {
  // Proves nested addresses are built correctly.
  it('builds nested course, class and summary paths', () => {
    expect(routeTo.course('swe-311')).toBe('/courses/swe-311')
    expect(routeTo.class('swe-311', 'c2')).toBe('/courses/swe-311/classes/c2')
    expect(routeTo.summary('swe-311', 'c2')).toBe('/courses/swe-311/classes/c2/summary')
  })

  // Proves note addresses.
  it('builds note paths', () => {
    expect(routeTo.note('n1')).toBe('/notes/n1')
    expect(routeTo.editNote('n1')).toBe('/notes/n1/edit')
  })

  // SECURITY: proves the class ID in "Add Note" is encoded, so it can't add query parameters.
  it('builds the new-note path for a class', () => {
    expect(routeTo.newNote('swe-311-c4')).toBe('/notes/new?classId=swe-311-c4')
    expect(routeTo.newNote('a&tab=x')).toBe('/notes/new?classId=a%26tab%3Dx')
  })

  // SECURITY: proves an ID with "/" or "?" is encoded, so it can't change the address's shape.
  it('encodes IDs so they cannot change the path structure', () => {
    expect(routeTo.note('a/b?c')).toBe('/notes/a%2Fb%3Fc')
  })

  // Proves the settings address.
  it('builds the settings path for a tab', () => {
    expect(routeTo.settings('privacy')).toBe('/settings/privacy')
  })

  // Proves the redirect is added only when given, and is fully encoded.
  it('adds an encoded redirect to the login path only when given one', () => {
    expect(routeTo.login()).toBe('/login')
    expect(routeTo.login('/notes?tab=summaries')).toBe('/login?redirect=%2Fnotes%3Ftab%3Dsummaries')
  })
})

describe('isSettingsTab', () => {
  // Proves every real tab is accepted.
  it.each(['profile', 'account', 'notifications', 'privacy', 'help'])('accepts %s', (tab) => {
    expect(isSettingsTab(tab)).toBe(true)
  })

  // Proves made-up, empty and missing tabs are refused.
  it.each(['billing', '', undefined])('rejects %s', (tab) => {
    expect(isSettingsTab(tab)).toBe(false)
  })
})
