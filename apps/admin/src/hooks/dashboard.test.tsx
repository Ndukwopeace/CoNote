/**
 * Tests for the dashboard's data hooks: each reads its service through the query cache, and a
 * failure arrives as an AppError.
 */

// Hook rendering and waiting.
import { renderHook, waitFor } from '@testing-library/react'
// Wrapper type.
import type { ReactNode } from 'react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The shared error type.
import { AppError } from '@conote/core/errors'

// The providers the hooks need.
import { AppProviders } from '@/app/AppProviders'
// The records the demo services read.
import { emptyPlatformData } from '@/services/platformData'
// Service types.
import type { Services } from '@/services/types'
// Demo services and a cache that doesn't retry.
import { createTestQueryClient, createTestServices } from '@/test/renderWithRouter'

// The units under test.
import { useActivitySeries, useAlerts, useHealth, useOverview } from './useDashboard'

/** A wrapper with the real providers around `services`. */
function wrapperFor(services: Services) {
  // A fresh cache for each test.
  const queryClient = createTestQueryClient()
  return ({ children }: { children: ReactNode }) => (
    <AppProviders services={services} queryClient={queryClient}>
      {children}
    </AppProviders>
  )
}

describe('dashboard hooks', () => {
  // Proves the overview and alerts come from their services.
  it('loads the overview and the alerts', async () => {
    // Arrange: one untaught course.
    const services = createTestServices(
      emptyPlatformData({
        courses: [{ id: 'c1', code: 'A', title: 'A', teacherId: null, archivedAt: null }],
      }),
    )
    const wrapper = wrapperFor(services)

    // Act.
    const overview = renderHook(() => useOverview(), { wrapper })
    const alerts = renderHook(() => useAlerts(), { wrapper })

    // Assert.
    await waitFor(() => {
      expect(overview.result.current.data?.activeCourses).toBe(1)
    })
    await waitFor(() => {
      expect(alerts.result.current.data).toEqual([{ kind: 'courses_without_teacher', count: 1 }])
    })
  })

  // Proves the series follows the range it is asked for.
  it('loads the series for the chosen range', async () => {
    // Arrange.
    const wrapper = wrapperFor(createTestServices())

    // Act.
    const { result } = renderHook(() => useActivitySeries(30, 'notes_created'), { wrapper })

    // Assert.
    await waitFor(() => {
      expect(result.current.data).toHaveLength(30)
    })
  })

  // Proves the health report comes from its service.
  it('loads the health report', async () => {
    // Arrange.
    const wrapper = wrapperFor(createTestServices())

    // Act.
    const { result } = renderHook(() => useHealth(), { wrapper })

    // Assert.
    await waitFor(() => {
      expect(result.current.data?.components.database).toBe('operational')
    })
  })

  // Proves a raw failure reaches the page as an AppError, never as the raw error.
  it('turns a failure into an AppError', async () => {
    // Arrange: a health service that throws something internal.
    const services: Services = {
      ...createTestServices(),
      health: { getHealth: () => Promise.reject(new Error('connection refused at 10.0.0.4')) },
    }

    // Act.
    const { result } = renderHook(() => useHealth(), { wrapper: wrapperFor(services) })

    // Assert.
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(AppError)
    })
    expect(result.current.error?.kind).toBe('unknown')
  })
})
