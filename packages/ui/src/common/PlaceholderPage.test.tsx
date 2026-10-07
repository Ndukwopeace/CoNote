/**
 * Tests for the temporary page body shown until a page is built.
 */

// Rendering and queries.
import { render, screen } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { PlaceholderPage } from './PlaceholderPage'

describe('PlaceholderPage', () => {
  // Proves users see plain words, never the team's milestone names ("M3").
  it('says "Coming soon" without internal milestone names', () => {
    // Act.
    render(<PlaceholderPage title="My Courses" description="Your enrolled courses." />)

    // Assert.
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
    expect(screen.queryByText(/\bM\d/)).toBeNull()
  })
})
