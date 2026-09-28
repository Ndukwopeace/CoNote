/**
 * Tests for the service factory.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The factory under test.
import { createServices } from './createServices'

describe('createServices', () => {
  // Proves demo mode gets working demo services.
  it('builds the mock services for the mock data source', async () => {
    // Act.
    const services = createServices({ dataSource: 'mock' })

    // Assert: the demo auth service answers (signed out, since storage is empty).
    await expect(services.auth.getSession()).resolves.toBeNull()
  })

  // Proves a Supabase deploy fails loudly until that stage is built, instead of half-working.
  it('fails fast for the Supabase data source until it is built', () => {
    expect(() =>
      createServices({
        dataSource: 'supabase',
        supabaseUrl: 'https://abc.supabase.co',
        supabaseAnonKey: 'key',
      }),
    ).toThrow(/not built yet/)
  })
})
