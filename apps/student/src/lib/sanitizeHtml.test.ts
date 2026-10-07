/**
 * Tests for the HTML sanitiser: the defence against cross-site scripting (XSS) in notes.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The function under test.
import { sanitizeHtml } from './sanitizeHtml'

describe('sanitizeHtml', () => {
  // Proves normal formatting survives untouched, so notes still look right.
  it('keeps the formatting the note editor produces', () => {
    // Arrange: headings, bold, italic, underline and a list.
    const html =
      '<h2>Title</h2><p><strong>Bold</strong> <em>it</em> <u>u</u></p><ul><li>a</li></ul>'

    // Assert: output equals input.
    expect(sanitizeHtml(html)).toBe(html)
  })

  // SECURITY: blocks the most direct XSS, a script element.
  it('removes script tags', () => {
    expect(sanitizeHtml('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>')
  })

  // SECURITY: blocks code hidden in event attributes such as onclick.
  it('removes event handler attributes', () => {
    expect(sanitizeHtml('<p onclick="alert(1)">hi</p>')).toBe('<p>hi</p>')
  })

  // Proves unknown tags are dropped without losing the student's words.
  it('removes tags outside the allow-list but keeps their text', () => {
    expect(sanitizeHtml('<div><span>text</span></div>')).toBe('text')
  })

  // SECURITY: blocks the classic <img onerror> XSS payload.
  it('drops images, which can carry onerror payloads', () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe('')
  })

  // SECURITY: blocks links that run code when clicked.
  it('drops javascript: links', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript')
  })

  // SECURITY: blocks links that carry a whole fake page.
  it('drops data: links', () => {
    expect(sanitizeHtml('<a href="data:text/html,x">x</a>')).not.toContain('data:')
  })

  // Proves safe links work, and SECURITY: open in a new tab without control of the CoNote tab.
  it('keeps https and mailto links and opens them safely in a new tab', () => {
    // Act.
    const result = sanitizeHtml('<a href="https://example.com">x</a><a href="mailto:a@b.co">m</a>')

    // Assert: both addresses kept...
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('href="mailto:a@b.co"')
    // ...and each link is isolated from the CoNote tab.
    expect(result).toContain('rel="noopener noreferrer"')
    expect(result).toContain('target="_blank"')
  })

  // SECURITY: blocks inline styles, which can hide text or fake parts of the page.
  it('drops style attributes', () => {
    expect(sanitizeHtml('<p style="color:red">x</p>')).toBe('<p>x</p>')
  })
})
