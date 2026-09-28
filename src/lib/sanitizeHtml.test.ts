import { describe, expect, it } from 'vitest'

import { sanitizeHtml } from './sanitizeHtml'

describe('sanitizeHtml', () => {
  it('keeps the formatting the note editor produces', () => {
    const html =
      '<h2>Title</h2><p><strong>Bold</strong> <em>it</em> <u>u</u></p><ul><li>a</li></ul>'

    expect(sanitizeHtml(html)).toBe(html)
  })

  it('removes script tags', () => {
    expect(sanitizeHtml('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>')
  })

  it('removes event handler attributes', () => {
    expect(sanitizeHtml('<p onclick="alert(1)">hi</p>')).toBe('<p>hi</p>')
  })

  it('removes tags outside the allow-list but keeps their text', () => {
    expect(sanitizeHtml('<div><span>text</span></div>')).toBe('text')
  })

  it('drops images, which can carry onerror payloads', () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe('')
  })

  it('drops javascript: links', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript')
  })

  it('drops data: links', () => {
    expect(sanitizeHtml('<a href="data:text/html,x">x</a>')).not.toContain('data:')
  })

  it('keeps https and mailto links and opens them safely in a new tab', () => {
    const result = sanitizeHtml('<a href="https://example.com">x</a><a href="mailto:a@b.co">m</a>')

    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('href="mailto:a@b.co"')
    expect(result).toContain('rel="noopener noreferrer"')
    expect(result).toContain('target="_blank"')
  })

  it('drops style attributes', () => {
    expect(sanitizeHtml('<p style="color:red">x</p>')).toBe('<p>x</p>')
  })
})
