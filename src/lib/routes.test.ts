import { describe, expect, it } from 'vitest'

import { isSettingsTab, routeTo } from './routes'

describe('routeTo', () => {
  it('builds nested course, class and summary paths', () => {
    expect(routeTo.course('swe-311')).toBe('/courses/swe-311')
    expect(routeTo.class('swe-311', 'c2')).toBe('/courses/swe-311/classes/c2')
    expect(routeTo.summary('swe-311', 'c2')).toBe('/courses/swe-311/classes/c2/summary')
  })

  it('builds note paths', () => {
    expect(routeTo.note('n1')).toBe('/notes/n1')
    expect(routeTo.editNote('n1')).toBe('/notes/n1/edit')
  })

  it('encodes IDs so they cannot change the path structure', () => {
    expect(routeTo.note('a/b?c')).toBe('/notes/a%2Fb%3Fc')
  })

  it('builds the settings path for a tab', () => {
    expect(routeTo.settings('privacy')).toBe('/settings/privacy')
  })

  it('adds an encoded redirect to the login path only when given one', () => {
    expect(routeTo.login()).toBe('/login')
    expect(routeTo.login('/notes?tab=summaries')).toBe('/login?redirect=%2Fnotes%3Ftab%3Dsummaries')
  })
})

describe('isSettingsTab', () => {
  it.each(['profile', 'account', 'notifications', 'privacy', 'help'])('accepts %s', (tab) => {
    expect(isSettingsTab(tab)).toBe(true)
  })

  it.each(['billing', '', undefined])('rejects %s', (tab) => {
    expect(isSettingsTab(tab)).toBe(false)
  })
})
