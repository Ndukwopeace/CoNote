/**
 * Tests for the data hooks that pages read courses, classes, notes, summaries and
 * notifications through.
 */

// Hook rendering and waiting helpers.
import { act, renderHook, waitFor } from '@testing-library/react'
// Type for the wrapper's children.
import type { ReactNode } from 'react'
// Vitest building blocks.
import { afterEach, describe, expect, it, vi } from 'vitest'

// The real providers.
import { AppProviders } from '@/app/AppProviders'
// The error type failures arrive as.
import { AppError } from '@conote/core/errors'
// Instant demo services and a no-retry cache.
import { createTestQueryClient, createTestServices } from '@/test/renderWithRouter'

// The hooks under test.
import { useClass, useCourseClasses, useMyClasses } from './useClasses'
import { useCourse, useMyCourses } from './useCourses'
import { useMyNotes } from './useNotes'
import { useNotifications, useUnreadCount } from './useNotifications'
import { useNow } from './useNow'
import { usePublishedSummaries } from './useSummaries'

/** Wraps a hook in the app providers with instant demo services. */
function wrapper({ children }: { children: ReactNode }) {
  return (
    <AppProviders services={createTestServices()} queryClient={createTestQueryClient()}>
      {children}
    </AppProviders>
  )
}

// Real timers again after the clock tests.
afterEach(() => {
  vi.useRealTimers()
})

describe('catalog hooks', () => {
  // Proves each hook returns the service's data.
  it('reads courses, classes, notes, summaries and notifications', async () => {
    // Act: every list hook at once.
    const { result } = renderHook(
      () => ({
        courses: useMyCourses(),
        course: useCourse('swe-311'),
        courseClasses: useCourseClasses('swe-311'),
        myClasses: useMyClasses(),
        session: useClass('swe-311-c1'),
        notes: useMyNotes({ courseId: 'swe-311' }),
        summaries: usePublishedSummaries({ courseId: 'swe-311' }),
        notifications: useNotifications(),
        unread: useUnreadCount(),
      }),
      { wrapper },
    )

    // Assert: all settle with the demo data.
    await waitFor(() => {
      expect(result.current.unread.data).toBe(3)
    })
    await waitFor(() => {
      expect(result.current.summaries.isSuccess).toBe(true)
    })
    expect(result.current.courses.data).toHaveLength(4)
    expect(result.current.course.data?.code).toBe('SWE 311')
    expect(result.current.courseClasses.data).toHaveLength(4)
    expect(result.current.myClasses.data?.length).toBeGreaterThan(4)
    expect(result.current.session.data?.title).toBe('Introduction to Software Engineering')
    expect(result.current.notes.data?.every((n) => n.courseId === 'swe-311')).toBe(true)
    expect(result.current.notifications.data).toHaveLength(8)
  })

  // Proves failures reach pages as AppErrors, so they can tell "not found" from other problems.
  it('reports an unknown course as a not_found AppError', async () => {
    // Act.
    const { result } = renderHook(() => useCourse('no-such-course'), { wrapper })

    // Assert.
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error).toBeInstanceOf(AppError)
    expect(result.current.error?.kind).toBe('not_found')
  })
})

describe('useNow', () => {
  // Proves the clock moves on its own, so Live and Upcoming badges change without a reload.
  it('updates every minute', () => {
    // Arrange: a frozen clock.
    vi.useFakeTimers({ now: new Date(2026, 8, 28, 9, 0) })
    const { result } = renderHook(() => useNow())
    const first = result.current.getTime()

    // Act: one minute passes.
    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    // Assert: a new time.
    expect(result.current.getTime()).toBe(first + 60_000)
  })
})
