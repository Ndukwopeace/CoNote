/**
 * Tests for the Users hooks: reading the list and details, and refreshing them after a change.
 */

// Hook rendering, waiting and state updates.
import { act, renderHook, waitFor } from '@testing-library/react'
// Wrapper type.
import type { ReactNode } from 'react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The providers the hooks need.
import { AppProviders } from '@/app/AppProviders'
// The records the demo services read.
import { emptyPlatformData, userRecord } from '@/services/platformData'
// Session builder and the session's storage key.
import { makeSession, SESSION_KEY } from '@/test/factories'
// Demo services and a cache that doesn't retry.
import { createTestQueryClient, createTestServices } from '@/test/renderWithRouter'

// The units under test.
import { useSetUserStatus, useUser, useUsers } from './useUsers'

/** Renders the hooks over a platform with one admin and one student, signed in as the admin. */
function setup() {
  // Sign in as admin a1.
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(makeSession('admin', { id: 'a1' })))
  // The platform and the providers.
  const services = createTestServices(
    emptyPlatformData({
      users: [
        userRecord({ id: 'a1', role: 'admin' }),
        userRecord({ id: 's1', role: 'student', fullName: 'Ada' }),
      ],
    }),
  )
  const queryClient = createTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders services={services} queryClient={queryClient}>
      {children}
    </AppProviders>
  )
  // All three hooks together, as a page would use them.
  return renderHook(
    () => ({
      list: useUsers({ role: 'student' }),
      details: useUser('s1'),
      setStatus: useSetUserStatus(),
    }),
    { wrapper },
  )
}

describe('users hooks', () => {
  // Proves a status change refreshes both the list and the details.
  it('refreshes the list and details after a status change', async () => {
    // Arrange.
    const { result } = setup()
    await waitFor(() => {
      expect(result.current.list.data?.items[0]?.status).toBe('active')
    })
    await waitFor(() => {
      expect(result.current.details.data?.status).toBe('active')
    })

    // Act.
    await act(() => result.current.setStatus.mutateAsync({ userId: 's1', status: 'suspended' }))

    // Assert.
    await waitFor(() => {
      expect(result.current.list.data?.items[0]?.status).toBe('suspended')
    })
    await waitFor(() => {
      expect(result.current.details.data?.status).toBe('suspended')
    })
  })
})
