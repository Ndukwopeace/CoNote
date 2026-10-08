/**
 * Tests for the shared building blocks of the course and class pages (REQUIREMENTS.md 6.4).
 */

// Rendering, queries and user input.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Icon for the empty state.
import { BookOpen } from 'lucide-react'
// A router for components that render links.
import { MemoryRouter } from 'react-router'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// The error type LoadError reads.
import { AppError } from '@conote/core/errors'
// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The units under test.
import { ClassListItem } from './ClassListItem'
import { CourseIcon } from './CourseIcon'
import { EmptyState } from './EmptyState'
import { LoadError } from './LoadError'
import { NotFoundPanel } from './NotFoundPanel'
import { PrivacyBanner } from './PrivacyBanner'
import { ListSkeleton } from './Skeletons'
import { StatusBadge } from './StatusBadge'
import { SummaryStateCard } from './SummaryStateCard'

describe('StatusBadge', () => {
  // Proves every status has readable text, so colour is never the only signal (NFR-2).
  it.each([
    ['live', 'Live'],
    ['upcoming', 'Upcoming'],
    ['completed', 'Completed'],
    ['ongoing', 'Ongoing'],
    ['published', 'Published'],
    ['in_review', 'In review'],
  ] as const)('labels %s as "%s"', (status, label) => {
    // Act.
    render(<StatusBadge status={status} />)

    // Assert.
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('CourseIcon', () => {
  // Proves the icon is decoration only; the course code next to it carries the meaning.
  it('is hidden from screen readers', () => {
    // Act.
    const { container } = render(<CourseIcon courseId="swe-311" />)

    // Assert.
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('EmptyState', () => {
  // Proves the title, message and action all show.
  it('shows a title, a message and an action', async () => {
    // Act.
    const { container } = render(
      <EmptyState icon={BookOpen} title="No courses" action={<button type="button">Clear</button>}>
        Nothing here yet.
      </EmptyState>,
    )

    // Assert.
    expect(screen.getByText('No courses')).toBeInTheDocument()
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    await expectNoAxeViolations(container)
  })
})

describe('LoadError', () => {
  // Proves a failed load explains itself and can be retried (section 11).
  it('shows the message and retries', async () => {
    // Arrange.
    const onRetry = vi.fn()
    render(<LoadError error={new AppError('network', 'x')} onRetry={onRetry} />)

    // Act.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))

    // Assert.
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't reach CoNote/)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  // Proves a missing record shows the not-found panel instead of an error with Retry.
  it('shows the not-found content for a not_found error', () => {
    // Act.
    render(
      <LoadError
        error={new AppError('not_found', 'x')}
        onRetry={vi.fn()}
        notFound={<p>Course not found</p>}
      />,
    )

    // Assert.
    expect(screen.getByText('Course not found')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  // SECURITY: proves an unexpected error's raw message never reaches the screen.
  it('hides the raw message of an unknown error', () => {
    // Act.
    render(
      <LoadError error={new AppError('unknown', 'SQL: select * from notes')} onRetry={vi.fn()} />,
    )

    // Assert.
    expect(screen.queryByText(/SQL/)).toBeNull()
  })
})

describe('NotFoundPanel', () => {
  // Proves the panel names what is missing and links back (section 11).
  it('shows a heading and a back link', async () => {
    // Act.
    const { container } = render(
      <MemoryRouter>
        <NotFoundPanel title="Course not found" backTo="/courses" backLabel="Back to My Courses" />
      </MemoryRouter>,
    )

    // Assert.
    expect(screen.getByRole('heading', { name: 'Course not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to My Courses' })).toHaveAttribute(
      'href',
      '/courses',
    )
    await expectNoAxeViolations(container)
  })
})

describe('PrivacyBanner', () => {
  // Proves the exact FR-CLS-3 wording.
  it('says notes are private', () => {
    // Act.
    render(<PrivacyBanner />)

    // Assert.
    expect(
      screen.getByText('Your notes are private. You can only see your own notes.'),
    ).toBeInTheDocument()
  })
})

describe('SummaryStateCard', () => {
  // Proves each stage shows its section 4 wording.
  it('explains the summary stage', () => {
    // Act.
    render(<SummaryStateCard status="in_review" />)

    // Assert.
    expect(screen.getByText('Summary in review')).toBeInTheDocument()
    expect(screen.getByText('Your teacher is reviewing the summary.')).toBeInTheDocument()
  })
})

describe('ClassListItem', () => {
  // Proves a class row links to its page and shows the course, class, time and status.
  it('shows the class and links to it', async () => {
    // Act.
    const { container } = render(
      <MemoryRouter>
        <ul>
          <ClassListItem
            to="/courses/swe-311/classes/swe-311-c4"
            courseId="swe-311"
            courseCode="SWE 311"
            title="SDLC Models"
            startsAt={new Date(2026, 8, 28, 9).toISOString()}
            endsAt={new Date(2026, 8, 28, 11).toISOString()}
            status="live"
          />
        </ul>
      </MemoryRouter>,
    )

    // Assert.
    const link = screen.getByRole('link', { name: /SDLC Models/ })
    expect(link).toHaveAttribute('href', '/courses/swe-311/classes/swe-311-c4')
    expect(link).toHaveTextContent('SWE 311')
    expect(link).toHaveTextContent('9 AM – 11 AM')
    expect(link).toHaveTextContent('Live')
    await expectNoAxeViolations(container)
  })
})

describe('ListSkeleton', () => {
  // Proves screen readers hear that content is loading, not a set of empty boxes.
  it('announces loading', () => {
    // Act.
    render(<ListSkeleton rows={3} />)

    // Assert.
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  })
})
