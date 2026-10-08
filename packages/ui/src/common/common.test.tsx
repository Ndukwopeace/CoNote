/**
 * Tests for the shared page parts: the stat card and the load-error panel.
 */

// Rendering, queries and user input.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// An icon for the stat card.
import { BookOpen } from 'lucide-react'
// A router for the stat card's link.
import { MemoryRouter } from 'react-router'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The units under test.
import { EmptyState } from './EmptyState'
import { ErrorPanel } from './ErrorPanel'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  // Proves the whole card is one link named by its value and label.
  it('links to its list', async () => {
    // Act.
    const { container } = render(
      <MemoryRouter>
        <StatCard label="My Courses" value={4} icon={BookOpen} to="/courses" />
      </MemoryRouter>,
    )

    // Assert.
    expect(screen.getByRole('link', { name: '4 My Courses' })).toHaveAttribute('href', '/courses')
    await expectNoAxeViolations(container)
  })
})

describe('ErrorPanel', () => {
  // Proves the message is announced at once and the button retries.
  it('announces the message and retries', async () => {
    // Arrange.
    const onRetry = vi.fn()
    const { container } = render(<ErrorPanel message="Unable to load alerts." onRetry={onRetry} />)

    // Act.
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    // Assert.
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load alerts.')
    expect(onRetry).toHaveBeenCalledOnce()
    await expectNoAxeViolations(container)
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
