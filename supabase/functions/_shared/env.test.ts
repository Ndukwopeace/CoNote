/**
 * Tests for reading the functions' settings and building the addresses emails link to.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import {
  DEFAULT_GROQ_MODEL,
  loginAddress,
  readEnv,
  readModelEnv,
  readPipelineEnv,
  resetAddress,
} from './env.ts'

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

describe('loginAddress', () => {
  // Proves each app's sign-in page address is built from its own app address (D118).
  it('points each role at its own sign-in page', () => {
    const env = readEnv((name) => FULL[name])
    expect(loginAddress(env, 'student')).toBe('https://app.example/login')
    expect(loginAddress(env, 'teacher')).toBe('https://teacher.example/teacher/login')
    expect(loginAddress(env, 'admin')).toBe('https://admin.example/admin/login')
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

describe('readPipelineEnv', () => {
  // Proves the key and token are read and the model defaults.
  it('reads the settings and defaults the model', () => {
    expect(readPipelineEnv((name) => ({ GROQ_API_KEY: 'k', PIPELINE_TOKEN: 't' })[name])).toEqual({
      groqApiKey: 'k',
      groqModel: DEFAULT_GROQ_MODEL,
      pipelineToken: 't',
    })
  })

  // Proves a model from the environment is used, trimmed, and a blank one means the default.
  it('uses a model from the environment', () => {
    const get = (model: string) => (name: string) =>
      ({ GROQ_API_KEY: 'k', PIPELINE_TOKEN: 't', GROQ_MODEL: model })[name]
    expect(readPipelineEnv(get(' llama-x ')).groqModel).toBe('llama-x')
    expect(readPipelineEnv(get('  ')).groqModel).toBe(DEFAULT_GROQ_MODEL)
  })

  // Proves every missing setting is named, so a bad deploy says what to fix.
  it('names the missing settings', () => {
    expect(() => readPipelineEnv(() => undefined)).toThrow(
      'Missing settings: GROQ_API_KEY, PIPELINE_TOKEN',
    )
    expect(() => readPipelineEnv((name) => (name === 'GROQ_API_KEY' ? 'k' : undefined))).toThrow(
      'Missing settings: PIPELINE_TOKEN',
    )
  })
})

describe('readModelEnv', () => {
  // Proves a function that only asks the model needs the key, not the pipeline's run token.
  it('reads the key and defaults the model, without a run token', () => {
    expect(readModelEnv((name) => ({ GROQ_API_KEY: 'k' })[name])).toEqual({
      groqApiKey: 'k',
      groqModel: DEFAULT_GROQ_MODEL,
    })
  })

  // Proves a model from the environment is used, and a missing key is named.
  it('uses a model from the environment and names a missing key', () => {
    expect(
      readModelEnv((name) => ({ GROQ_API_KEY: 'k', GROQ_MODEL: ' openai/x ' })[name]).groqModel,
    ).toBe('openai/x')
    expect(() => readModelEnv(() => undefined)).toThrow('Missing settings: GROQ_API_KEY')
  })
})
