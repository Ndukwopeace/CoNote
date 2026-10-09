/**
 * Tests for the dashboard (admin REQUIREMENTS section 10): the greeting, the counts, the activity
 * chart, system health and alerts, each with its loading, empty and error states.
 */

// Queries.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The shared error type.
import { AppError } from '@conote/core/errors'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The routes, so the page renders inside the real layout.
import { routes } from '@/app/routes'
// The demo health override, and the session builder.
import { HEALTH_OVERRIDE_KEY, makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'
// The records the demo services read.
import {
  courseRecord,
  emptyPlatformData,
  userRecord,
  type PlatformData,
  aiJobRecord,
} from '@/services/platformData'
// Service types.
import type { Services } from '@/services/types'

/** 9:30 in the morning on 8 October 2026, local time. */
const MORNING = new Date(2026, 9, 8, 9, 30)

/** `hours` hours before MORNING, as ISO text. */
function hoursAgo(hours: number) {
  return new Date(MORNING.getTime() - hours * 3_600_000).toISOString()
}

/** A small platform: two students, a teacher, two courses (one untaught), and some activity. */
function smallPlatform(): PlatformData {
  return emptyPlatformData({
    users: [
      userRecord({ id: 's1', role: 'student' }),
      userRecord({ id: 's2', role: 'student', status: 'pending' }),
      userRecord({ id: 't1', role: 'teacher' }),
    ],
    courses: [
      courseRecord({ id: 'c1', code: 'SWE 311', title: 'SE', teacherId: 't1', archivedAt: null }),
      courseRecord({ id: 'c2', code: 'CSC 301', title: 'OS', teacherId: null, archivedAt: null }),
    ],
    aiJobs: [aiJobRecord({ id: 'j1', classId: 'k1', status: 'failed', finishedAt: hoursAgo(2) })],
    activity: [
      { kind: 'note_created', at: hoursAgo(1) },
      { kind: 'note_created', at: hoursAgo(2) },
      { kind: 'note_created', at: hoursAgo(26) },
      { kind: 'ai_question', at: hoursAgo(1) },
    ],
  })
}

/** Renders the dashboard as Amara, over `platform`, with any service replaced. */
function renderDashboard(platform = smallPlatform(), overrides: Partial<Services> = {}) {
  return renderWithRouter({
    routes,
    path: '/admin/dashboard',
    session: makeSession('admin', { fullName: 'Amara Okafor' }),
    platform,
    overrides,
  })
}

/** A service call that fails with an internal-looking error. */
const fail = () => Promise.reject(new AppError('unknown', 'relation "ai_jobs" does not exist'))

describe('DashboardPage', () => {
  // Only the clock is faked, so timers in the UI still run.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(MORNING)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // Proves the greeting follows the time of day and uses the first name.
  it('greets the administrator by first name', async () => {
    // Act.
    renderDashboard()

    // Assert.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Good morning, Amara' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Here’s an overview of your CoNote platform.')).toBeInTheDocument()
  })

  // Proves the stat cards show real counts and open their lists.
  it('shows the platform counts as links', async () => {
    // Act.
    renderDashboard()

    // Assert.
    expect(await screen.findByRole('link', { name: '2 Students' })).toHaveAttribute(
      'href',
      '/admin/users?role=student',
    )
    expect(screen.getByRole('link', { name: '1 Teachers' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '2 Active courses' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '0 AI jobs running or queued' })).toBeInTheDocument()
  })

  // Proves each alert reads plainly and links to the screen that fixes it.
  it('lists alerts that link to the fix', async () => {
    // Act.
    renderDashboard()

    // Assert: the failed job first (critical), then the untaught course.
    const list = await screen.findByRole('list', { name: 'Alerts' })
    const links = within(list).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'Critical: 1 AI job failed in the last 24 hours',
      'Warning: 1 course has no teacher',
    ])
    expect(links[1]).toHaveAttribute('href', '/admin/courses?teacher=none')
  })

  // Proves a calm platform says so instead of showing an empty box.
  it('says when there are no alerts', async () => {
    // Act.
    renderDashboard(emptyPlatformData())

    // Assert.
    expect(
      await screen.findByText('No alerts. Everything is running normally.'),
    ).toBeInTheDocument()
  })

  // Proves each health state shows in words, and a part the check left out shows "Unknown".
  it('shows each part of the platform with its state', async () => {
    // Arrange.
    window.localStorage.setItem(
      HEALTH_OVERRIDE_KEY,
      JSON.stringify({ ai_service: 'degraded', storage: 'unavailable', notifications: 'unknown' }),
    )

    // Act.
    renderDashboard()

    // Assert.
    const health = await screen.findByRole('list', { name: 'System health' })
    const rows = await within(health).findAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      'DatabaseOperational',
      'AuthenticationOperational',
      'AI serviceDegraded',
      'StorageUnavailable',
      'NotificationsUnknown',
    ])
  })

  // Proves the chart covers the chosen range and series, with a table of the same values.
  it('charts the chosen series and range, with a table view', async () => {
    // Arrange.
    const { user } = renderDashboard()
    const chart = await screen.findByRole('figure', { name: /Notes created per day/ })
    // Default: the last 7 days, three notes in total.
    expect(chart).toHaveAccessibleName(/3 in total/)

    // Act: switch to AI questions over 30 days, then show the table.
    await user.selectOptions(screen.getByLabelText('Show'), 'ai_questions')
    await user.click(screen.getByRole('button', { name: 'Last 30 days' }))
    await user.click(screen.getByRole('button', { name: 'Show as table' }))

    // Assert: the table has 30 days, and today's row shows the one question.
    const table = await screen.findByRole('table', { name: /AI questions per day/ })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(31)
    expect(rows.at(-1)).toHaveTextContent('Thu 8 Oct1')
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  // Proves an empty period says so instead of drawing a flat line.
  it('says when nothing happened in the period', async () => {
    // Act.
    renderDashboard(emptyPlatformData())

    // Assert.
    expect(await screen.findByText('Nothing was recorded in this period.')).toBeInTheDocument()
  })

  // Proves one failing part shows its own error and retry, and the rest of the page still works.
  it('shows a failed part on its own, without raw details', async () => {
    // Act: alerts and health fail.
    renderDashboard(smallPlatform(), {
      alerts: { listAlerts: fail },
      health: { getHealth: fail },
    })

    // Assert: their messages, no raw error, and the counts still load.
    expect(await screen.findByText('Unable to load alerts.')).toBeInTheDocument()
    expect(await screen.findByText('Unable to load system health.')).toBeInTheDocument()
    expect(screen.queryByText(/relation/)).toBeNull()
    expect(await screen.findByRole('link', { name: '2 Students' })).toBeInTheDocument()
  })

  // Proves the counts and the chart have their own error states too.
  it('shows errors for the counts and the chart', async () => {
    // Act.
    renderDashboard(smallPlatform(), {
      analytics: { getOverview: fail, getActivitySeries: fail },
    })

    // Assert.
    expect(await screen.findByText('Unable to load platform statistics.')).toBeInTheDocument()
    expect(await screen.findByText('Unable to load activity.')).toBeInTheDocument()
  })

  // Proves the finished page has no accessibility problems.
  it('has no accessibility violations', async () => {
    // Act.
    const { container } = renderDashboard()
    await screen.findByRole('list', { name: 'Alerts' })
    await screen.findByRole('list', { name: 'System health' })
    await screen.findByRole('figure', { name: /per day/ })

    // Assert.
    await expectNoAxeViolations(container)
  })
})
