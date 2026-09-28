import { describe, expect, it } from 'vitest'

import { clearUserData, storageKey } from './storage'

describe('storageKey', () => {
  it('prefixes every key with the app namespace', () => {
    expect(storageKey('draft', 'class-1')).toBe('conote:draft:class-1')
  })
})

describe('clearUserData', () => {
  it('removes session, draft and AI keys from every store', () => {
    window.localStorage.setItem('conote:session', 'x')
    window.localStorage.setItem('conote:draft:class-1', 'x')
    window.sessionStorage.setItem('conote:session', 'x')
    window.sessionStorage.setItem('conote:ai:conversation', 'x')

    clearUserData([window.localStorage, window.sessionStorage])

    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('keeps mock demo data, which stands in for the server', () => {
    window.localStorage.setItem('conote:mock:notes', '[]')

    clearUserData([window.localStorage])

    expect(window.localStorage.getItem('conote:mock:notes')).toBe('[]')
  })

  it('leaves keys that belong to other apps alone', () => {
    window.localStorage.setItem('other-app:setting', 'x')

    clearUserData([window.localStorage])

    expect(window.localStorage.getItem('other-app:setting')).toBe('x')
  })
})
