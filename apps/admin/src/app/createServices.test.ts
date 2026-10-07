/**
 * Tests for choosing the service implementation from the configuration.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { createServices } from './createServices'

describe('createServices', () => {
  // Proves demo mode gets working demo services.
  it('builds the demo services in mock mode', async () => {
    const services = createServices({ dataSource: 'mock' })
    await expect(services.auth.getSession()).resolves.toBeNull()
  })

  // Proves Supabase mode fails at once with instructions, until the backend stage builds it.
  it('refuses to start in Supabase mode for now', () => {
    expect(() =>
      createServices({
        dataSource: 'supabase',
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon',
      }),
    ).toThrow(/not built yet/)
  })
})
