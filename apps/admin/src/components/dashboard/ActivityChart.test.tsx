/**
 * Tests for the activity chart: its description, and moving the crosshair by keyboard and pointer.
 */

// Rendering, queries, events and user input.
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Vitest building blocks.
import { describe, expect, it, vi } from 'vitest'

// Accessibility check.
import { expectNoAxeViolations } from '@conote/testing/axe'

// The unit under test.
import { ActivityChart } from './ActivityChart'

/** Five days of counts, the busiest on the 3rd. */
const POINTS = [
  { date: '2026-10-01', count: 2 },
  { date: '2026-10-02', count: 5 },
  { date: '2026-10-03', count: 9 },
  { date: '2026-10-04', count: 0 },
  { date: '2026-10-05', count: 4 },
]

/** Renders the chart over POINTS. */
function renderChart() {
  return render(<ActivityChart points={POINTS} label="Notes created" refreshing={false} />)
}

describe('ActivityChart', () => {
  // Proves the figure is named by one sentence: the range, the total and the busiest day.
  it('describes the whole series', async () => {
    // Act.
    const { container } = renderChart()

    // Assert.
    expect(screen.getByRole('figure')).toHaveAccessibleName(
      'Notes created per day, Thu 1 Oct to Mon 5 Oct: 20 in total, most on Sat 3 Oct (9).',
    )
    await expectNoAxeViolations(container)
  })

  // Proves the keyboard moves the crosshair day by day, and to either end.
  it('moves between days with the keyboard', async () => {
    // Arrange.
    const user = userEvent.setup()
    renderChart()
    const slider = screen.getByRole('slider', { name: 'Notes created, day' })

    // Act and assert: focus starts on today.
    await user.tab()
    expect(slider).toHaveAttribute('aria-valuetext', 'Mon 5 Oct: 4')
    // Left twice.
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(slider).toHaveAttribute('aria-valuetext', 'Sat 3 Oct: 9')
    // Home, then End.
    await user.keyboard('{Home}')
    expect(slider).toHaveAttribute('aria-valuetext', 'Thu 1 Oct: 2')
    await user.keyboard('{End}')
    expect(slider).toHaveAttribute('aria-valuenow', '4')
    // Right at the end stays at the end.
    await user.keyboard('{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuenow', '4')
  })

  // Proves the pointer snaps to the nearest day and the tooltip shows its value.
  it('follows the pointer to the nearest day', () => {
    // Arrange: a 400px-wide plot.
    renderChart()
    const slider = screen.getByRole('slider')
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 400, height: 192 }),
    )

    // Act: halfway across is the 3rd day.
    fireEvent.pointerMove(slider, { clientX: 210 })

    // Assert.
    expect(slider).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByText('Sat 3 Oct')).toBeInTheDocument()

    // Act: leaving clears the crosshair.
    fireEvent.pointerLeave(slider)

    // Assert.
    expect(screen.queryByText('Sat 3 Oct')).toBeNull()
  })

  // Proves a plot that hasn't been laid out yet ignores the pointer instead of failing.
  it('ignores the pointer before layout', () => {
    // Arrange: jsdom's zero-width box.
    renderChart()
    const slider = screen.getByRole('slider')

    // Act.
    fireEvent.pointerMove(slider, { clientX: 50 })

    // Assert: nothing highlighted, so the slider still reports today.
    expect(screen.queryByText('Mon 5 Oct')).toBeNull()
    expect(slider).toHaveAttribute('aria-valuenow', '4')
  })
})
