/**
 * Tests for turning a stored note into plain text for a teacher or administrator to read (D123).
 * Notes are stored as small pieces of HTML, and old ones may hold lists or headings. Staff screens
 * show text only, so no markup from a student can ever run in a staff member's browser.
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The unit under test.
import { noteHtmlToText } from './noteText'

describe('noteHtmlToText', () => {
  // Proves paragraphs and line breaks become lines.
  it('puts each paragraph and line break on its own line', () => {
    expect(noteHtmlToText('<p>First line</p><p>Second line<br>third</p>')).toBe(
      'First line\nSecond line\nthird',
    )
  })

  // Proves the markup of older rich notes is dropped but its words stay, one list item per line.
  it('keeps the words of lists, headings and emphasis', () => {
    expect(noteHtmlToText('<h2>Title</h2><ul><li>one</li><li><strong>two</strong></li></ul>')).toBe(
      'Title\none\ntwo',
    )
  })

  // SECURITY: proves a script or style block is removed with its contents, and an event handler or
  // link target never appears, so nothing a student typed can run or link out of a staff screen.
  it('drops script and style blocks and attributes', () => {
    const html =
      '<p onclick="steal()">Hello</p><script>alert(1)</script><style>p{}</style><a href="javascript:x">link</a>'
    expect(noteHtmlToText(html)).toBe('Hello\nlink')
  })

  // Proves the characters a note stores as entities read as themselves, and typed markup shows as text.
  it('decodes the common entities', () => {
    expect(noteHtmlToText('<p>a &lt; b &amp; c &gt; d &quot;q&quot; it&#39;s&nbsp;fine</p>')).toBe(
      'a < b & c > d "q" it\'s fine',
    )
  })

  // Proves the blank space a note may carry is tidied: one space inside a line, no empty lines at
  // the ends, and at most one empty line between paragraphs.
  it('tidies spaces and blank lines', () => {
    expect(noteHtmlToText('<p>  spaced    out  </p><p></p><p></p><p>next</p>')).toBe(
      'spaced out\n\nnext',
    )
  })

  // Proves a note with no text, a broken tag and plain text without markup all give something sane.
  it('copes with empty text, a half-written tag and plain text', () => {
    expect(noteHtmlToText('')).toBe('')
    expect(noteHtmlToText('<p></p>')).toBe('')
    expect(noteHtmlToText('plain words')).toBe('plain words')
    expect(noteHtmlToText('before <b unfinished')).toBe('before <b unfinished')
  })
})
