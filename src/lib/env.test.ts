import { describe, expect, it } from 'vitest'

import { parseEnv } from './env'

describe('parseEnv', () => {
  it('defaults to the mock data source', () => {
    expect(parseEnv({})).toEqual({ dataSource: 'mock' })
  })

  it('accepts the mock data source without Supabase settings', () => {
    expect(parseEnv({ VITE_DATA_SOURCE: 'mock' })).toEqual({ dataSource: 'mock' })
  })

  it('reads Supabase settings when the data source is supabase', () => {
    expect(
      parseEnv({
        VITE_DATA_SOURCE: 'supabase',
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toEqual({
      dataSource: 'supabase',
      supabaseUrl: 'https://abc.supabase.co',
      supabaseAnonKey: 'anon-key',
    })
  })

  it('fails fast when the supabase data source has no URL or key', () => {
    expect(() => parseEnv({ VITE_DATA_SOURCE: 'supabase' })).toThrow(/VITE_SUPABASE_URL/)
  })

  it('rejects a Supabase URL that is not https', () => {
    expect(() =>
      parseEnv({
        VITE_DATA_SOURCE: 'supabase',
        VITE_SUPABASE_URL: 'http://abc.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toThrow(/VITE_SUPABASE_URL/)
  })

  it('rejects an unknown data source', () => {
    expect(() => parseEnv({ VITE_DATA_SOURCE: 'firebase' })).toThrow(/VITE_DATA_SOURCE/)
  })
})
