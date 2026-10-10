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

  // Proves Supabase mode connects sign-in and leaves the unbuilt services failing clearly, so a
  // half-connected deploy shows an error instead of demo data.
  it('connects sign-in in Supabase mode and refuses the rest for now', async () => {
    const services = await createServices({
      dataSource: 'supabase',
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
    })
    // Nobody is signed in on a fresh browser; this is answered from storage, with no network.
    await expect(services.auth.getSession()).resolves.toBeNull()
    await expect(services.users.getUser('x')).rejects.toMatchObject({
      message: 'Users is not connected to the database yet.',
    })
  })
})
