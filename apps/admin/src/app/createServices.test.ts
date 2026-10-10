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
    const services = await createServices({ dataSource: 'mock' })
    await expect(services.auth.getSession()).resolves.toBeNull()
  })

  // Proves Supabase mode builds every service, and sign-in is answered from storage.
  it('builds every service in Supabase mode', async () => {
    const services = await createServices({
      dataSource: 'supabase',
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
    })
    // Nobody is signed in on a fresh browser; this is answered from storage, with no network.
    await expect(services.auth.getSession()).resolves.toBeNull()
    // Every service exists.
    expect(Object.keys(services).sort()).toEqual([
      'alerts',
      'analytics',
      'auth',
      'classes',
      'courses',
      'health',
      'users',
    ])
  })
})
