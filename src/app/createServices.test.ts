import { describe, expect, it } from 'vitest'

import { createServices } from './createServices'

describe('createServices', () => {
  it('builds the mock services for the mock data source', async () => {
    const services = createServices({ dataSource: 'mock' })

    await expect(services.auth.getSession()).resolves.toBeNull()
  })

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
