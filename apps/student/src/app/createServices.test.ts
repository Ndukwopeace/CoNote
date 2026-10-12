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
    const services = await createServices({ dataSource: 'mock' })

    // Assert: the demo auth service answers (signed out, since storage is empty).
    await expect(services.auth.getSession()).resolves.toBeNull()
  })

  // Proves the Supabase data source builds with the real services, never silently showing demo
  // data.
  it('builds the Supabase services', async () => {
    // Act.
    const services = await createServices({
      dataSource: 'supabase',
      supabaseUrl: 'https://abc.supabase.co',
      supabaseAnonKey: 'key',
    })

    // Assert: auth is the real service (no stored session, so signed out without a request)...
    await expect(services.auth.getSession()).resolves.toBeNull()
    // ...and Ask AI is the real service, not the labelled demo.
    expect(services.ai.isPreview).toBe(false)
    // The demo-only actions are absent outside mock mode.
    expect(services.demo).toBeUndefined()
  })
})
