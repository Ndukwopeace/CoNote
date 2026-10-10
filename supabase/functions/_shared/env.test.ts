/**
 * Tests for reading the functions' settings and building the addresses emails link to.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { readEnv, resetAddress } from './env.ts'

/** A full set of settings. */
const FULL: Record<string, string> = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  APP_URL_STUDENT: 'https://app.example/',
  APP_URL_TEACHER: 'https://teacher.example//',
  APP_URL_ADMIN: 'https://admin.example',
}

describe('readEnv', () => {
  // Proves every setting is read, and app addresses lose their trailing slashes.
  it('reads the settings and trims the app addresses', () => {
    const env = readEnv((name) => FULL[name])
    expect(env).toMatchObject({
      url: 'https://project.supabase.co',
      anonKey: 'anon',
      serviceKey: 'service',
    })
    expect(env.appUrls).toEqual({
      student: 'https://app.example',
      teacher: 'https://teacher.example',
      admin: 'https://admin.example',
    })
  })

  // Proves a missing setting stops the function and says which.
  it('names every missing setting', () => {
    expect(() =>
      readEnv((name) =>
        name === 'APP_URL_ADMIN' || name === 'SUPABASE_URL' ? undefined : FULL[name],
      ),
    ).toThrow('Missing settings: SUPABASE_URL, APP_URL_ADMIN')
  })
})

describe('resetAddress', () => {
  // Proves each role's email opens its own app's reset page.
  it('points each role at its own app', () => {
    const env = readEnv((name) => FULL[name])
    expect(resetAddress(env, 'student')).toBe('https://app.example/reset-password')
    expect(resetAddress(env, 'teacher')).toBe('https://teacher.example/teacher/reset-password')
    expect(resetAddress(env, 'admin')).toBe('https://admin.example/admin/reset-password')
  })
})
