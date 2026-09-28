/**
 * Tests for environment-variable checking. The app must refuse to start when misconfigured.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The function under test (not `env`, which reads the real environment).
import { parseEnv } from './env'

describe('parseEnv', () => {
  // Proves a blank setup gives demo mode, so `npm run dev` works with no .env file.
  it('defaults to the mock data source', () => {
    expect(parseEnv({})).toEqual({ dataSource: 'mock' })
  })

  // Proves demo mode needs no Supabase settings.
  it('accepts the mock data source without Supabase settings', () => {
    expect(parseEnv({ VITE_DATA_SOURCE: 'mock' })).toEqual({ dataSource: 'mock' })
  })

  // Proves Supabase settings are read and renamed correctly.
  it('reads Supabase settings when the data source is supabase', () => {
    // Act and assert in one: valid settings in, friendly names out.
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

  // Proves missing settings stop the app, and the message names the missing variable.
  it('fails fast when the supabase data source has no URL or key', () => {
    expect(() => parseEnv({ VITE_DATA_SOURCE: 'supabase' })).toThrow(/VITE_SUPABASE_URL/)
  })

  // SECURITY: proves a plain-http backend address is refused, since it would expose sessions.
  it('rejects a Supabase URL that is not https', () => {
    expect(() =>
      parseEnv({
        VITE_DATA_SOURCE: 'supabase',
        VITE_SUPABASE_URL: 'http://abc.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toThrow(/VITE_SUPABASE_URL/)
  })

  // Proves a typo in the data source is caught rather than silently ignored.
  it('rejects an unknown data source', () => {
    expect(() => parseEnv({ VITE_DATA_SOURCE: 'firebase' })).toThrow(/VITE_DATA_SOURCE/)
  })
})
