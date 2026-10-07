/**
 * Tests for SafeHtml, the only component allowed to render user HTML.
 */

// render mounts the component; screen queries what's on screen.
import { render, screen } from '@testing-library/react'
// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The component under test.
import { SafeHtml } from './SafeHtml'

describe('SafeHtml', () => {
  // Proves allowed formatting is rendered as real elements, not as text.
  it('renders allowed formatting', () => {
    // Act.
    render(<SafeHtml html="<p><strong>Key idea</strong></p>" />)

    // Assert: the words are inside a <strong> element.
    expect(screen.getByText('Key idea').tagName).toBe('STRONG')
  })

  // SECURITY: proves a script in a note never reaches the page (XSS).
  it('never renders a script element', () => {
    // Act.
    const { container } = render(<SafeHtml html="<p>hi</p><script>alert(1)</script>" />)

    // Assert: no <script> anywhere in the output.
    expect(container.querySelector('script')).toBeNull()
  })

  // Proves callers can style the wrapper.
  it('passes a class name to the wrapper', () => {
    // Act.
    const { container } = render(<SafeHtml html="<p>x</p>" className="prose" />)

    // Assert.
    expect(container.firstElementChild).toHaveClass('prose')
  })
})
