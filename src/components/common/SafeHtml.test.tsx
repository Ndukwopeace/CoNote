import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SafeHtml } from './SafeHtml'

describe('SafeHtml', () => {
  it('renders allowed formatting', () => {
    render(<SafeHtml html="<p><strong>Key idea</strong></p>" />)

    expect(screen.getByText('Key idea').tagName).toBe('STRONG')
  })

  it('never renders a script element', () => {
    const { container } = render(<SafeHtml html="<p>hi</p><script>alert(1)</script>" />)

    expect(container.querySelector('script')).toBeNull()
  })

  it('passes a class name to the wrapper', () => {
    const { container } = render(<SafeHtml html="<p>x</p>" className="prose" />)

    expect(container.firstElementChild).toHaveClass('prose')
  })
})
