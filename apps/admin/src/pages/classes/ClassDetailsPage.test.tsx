/**
 * Tests for the class details page (admin REQUIREMENTS section 13): the facts and counts, the AI
 * job history, the summary timeline, editing and archiving.
 */

// Queries and waiting.
import { screen, within } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The routes, so the page renders inside the real layout.
import { routes } from '@/app/routes'
// Local dates and times.
import { toIso } from '@/lib/classTimes'
// Dates, worded as the screens word them.
import { formatDate } from '@/lib/format'
// The records the demo services read.
import {
  aiJobRecord,
  classRecord,
  courseRecord,
  emptyPlatformData,
  userRecord,
  type PlatformData,
} from '@/services/platformData'
// Session builder.
import { makeSession } from '@/test/factories'
// Render helper.
import { renderWithRouter } from '@/test/renderWithRouter'

/** The platform: CSC 101 (taught, 2 students) with a published class and a bare one. */
function platform(): PlatformData {
  return emptyPlatformData({
    users: [
      userRecord({ id: 'admin-test', role: 'admin', fullName: 'Amara Okafor' }),
      userRecord({ id: 't1', role: 'teacher', fullName: 'Dr. Smith' }),
    ],
    courses: [courseRecord({ id: 'c1', code: 'CSC 101', title: 'Programming', teacherId: 't1' })],
    enrollments: [
      { courseId: 'c1', studentId: 's1' },
      { courseId: 'c1', studentId: 's2' },
    ],
    classes: [
      classRecord({
        id: 'k1',
        courseId: 'c1',
        number: 1,
        title: 'Variables',
        description: 'Names and values.',
        startsAt: toIso('2026-09-10', '09:00'),
        endsAt: toIso('2026-09-10', '10:30'),
        noteCount: 14,
      }),
      classRecord({ id: 'k2', courseId: 'c1', number: 2, title: 'Loops' }),
    ],
    summaries: [
      {
        id: 'sm1',
        classId: 'k1',
        status: 'published',
        inReviewSince: '2026-09-10T13:00:00.000Z',
        publishedAt: '2026-09-12T09:00:00.000Z',
      },
    ],
    aiJobs: [
      aiJobRecord({
        id: 'j1',
        classId: 'k1',
        status: 'failed',
        attempt: 1,
        createdAt: '2026-09-10T11:30:00.000Z',
        finishedAt: '2026-09-10T11:45:00.000Z',
      }),
      aiJobRecord({
        id: 'j2',
        classId: 'k1',
        status: 'succeeded',
        attempt: 2,
        createdAt: '2026-09-10T12:30:00.000Z',
        finishedAt: '2026-09-10T13:00:00.000Z',
      }),
    ],
  })
}

/** Renders the details page for `classId`, as the signed-in admin. */
function renderClass(classId = 'k1') {
  return renderWithRouter({
    routes,
    path: `/admin/classes/${classId}`,
    session: makeSession('admin', { fullName: 'Amara Okafor' }),
    platform: platform(),
  })
}

describe('ClassDetailsPage', () => {
  // Proves the page shows the facts the spec lists.
  it('shows the class facts and counts', async () => {
    renderClass()

    expect(await screen.findByRole('heading', { level: 1, name: 'Variables' })).toBeInTheDocument()
    const facts = screen.getByRole('region', { name: 'Details' })
    const fact = (term: string) => within(facts).getByText(term).nextElementSibling
    expect(fact('Course')).toHaveTextContent('CSC 101 Programming')
    expect(within(fact('Course') as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      '/admin/courses/c1',
    )
    expect(fact('Class number')?.textContent).toBe('1')
    expect(fact('Teacher')?.textContent).toBe('Dr. Smith')
    expect(fact('Date and time')?.textContent).toBe(
      `${formatDate(toIso('2026-09-10', '09:00'))} 09:00–10:30`,
    )
    expect(fact('Enrolled students')?.textContent).toBe('2')
    expect(fact('Notes contributed')?.textContent).toBe('14')
    expect(within(facts).getByText('Names and values.')).toBeInTheDocument()
  })

  // Proves the AI job history lists every attempt, oldest first.
  it('lists the AI job history', async () => {
    renderClass()
    const history = await screen.findByRole('list', { name: 'AI job history' })
    const items = within(history).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Attempt 1')
    expect(items[0]).toHaveTextContent('Failed')
    expect(items[1]).toHaveTextContent('Attempt 2')
    expect(items[1]).toHaveTextContent('Succeeded')
  })

  // Proves a class without jobs says so.
  it('says when no AI job has run', async () => {
    renderClass('k2')
    expect(await screen.findByText('No AI jobs have run for this class.')).toBeInTheDocument()
  })

  // Proves the timeline shows every stage and which were reached.
  it('shows the summary timeline', async () => {
    renderClass()
    const timeline = await screen.findByRole('list', { name: 'Summary timeline' })
    const steps = within(timeline).getAllByRole('listitem')
    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining('Collecting notes'),
      expect.stringContaining('Processing'),
      expect.stringContaining('In review'),
      expect.stringContaining('Published'),
    ])
    expect(steps[3]).toHaveTextContent(formatDate('2026-09-12T09:00:00.000Z'))
  })

  // Proves stages not reached say so.
  it('marks stages not reached', async () => {
    renderClass('k2')
    const timeline = await screen.findByRole('list', { name: 'Summary timeline' })
    const steps = within(timeline).getAllByRole('listitem')
    expect(steps.every((step) => step.textContent.includes('Not reached yet'))).toBe(true)
  })

  // Proves an unknown class gets its own message and the way back.
  it('shows a not-found message', async () => {
    renderClass('nope')
    expect(await screen.findByRole('heading', { name: 'Class not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Classes' })).toHaveAttribute(
      'href',
      '/admin/classes',
    )
  })

  // Proves editing saves and the heading follows.
  it('edits the class', async () => {
    const { user } = renderClass()
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: /Edit Variables/ })
    await user.clear(within(dialog).getByLabelText('Class title'))
    await user.type(within(dialog).getByLabelText('Class title'), 'Variables II')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Variables II' }),
    ).toBeInTheDocument()
  })

  // Proves archiving asks first, then locks the page but keeps the notes and summary visible.
  it('archives after confirmation', async () => {
    const { user } = renderClass()
    await user.click(await screen.findByRole('button', { name: 'Archive' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Archive “Variables”?' })
    await user.click(within(confirm).getByRole('button', { name: 'Archive' }))

    expect(
      await screen.findByText('This class is archived. It can’t be changed.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
    // The notes count and summary are still there.
    expect(screen.getByRole('list', { name: 'Summary timeline' })).toBeInTheDocument()
  })

  // Proves the page has no accessibility violations.
  it('has no accessibility violations', async () => {
    const { container } = renderClass()
    await screen.findByRole('heading', { level: 1, name: 'Variables' })
    await expectNoAxeViolations(container)
  })
})
