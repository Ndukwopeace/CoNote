/**
 * Tests for the note rules shared by the form and the note service (FR-NTE-1 to FR-NTE-4).
 */

// Vitest building blocks.
import { describe, expect, it } from 'vitest'

// The rules under test.
import {
  addTag,
  firstLine,
  hasRichFormatting,
  htmlToComposerText,
  htmlToText,
  MAX_BODY_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  noteInputSchema,
  otherTags,
  presetTag,
  resolveNoteTitle,
  typedTitle,
  textToNoteHtml,
} from './notes'

/** A valid note input; tests override one field at a time. */
function input(overrides: Record<string, unknown> = {}) {
  return { classId: 'swe-311-c1', title: '', contentHtml: '<p>Hello</p>', tags: [], ...overrides }
}

describe('htmlToText', () => {
  // Proves only visible text is counted, not markup.
  it('returns the text without tags', () => {
    expect(htmlToText('<p><strong>Hi</strong> there</p>')).toBe('Hi there')
  })

  // SECURITY: proves parsing runs nothing; the text of a script is not executed, only read.
  it('does not run scripts while reading', () => {
    // Arrange: a flag a script would set.
    const target = window as unknown as { pwned?: boolean }

    // Act.
    htmlToText('<img src=x onerror="window.pwned=true"><script>window.pwned=true</script>')

    // Assert.
    expect(target.pwned).toBeUndefined()
  })
})

describe('firstLine', () => {
  // Proves the first non-empty block is used, so a blank title gets a sensible stand-in.
  it('returns the first block with text', () => {
    expect(firstLine('<p></p><h2>Waterfall</h2><p>Second</p>')).toBe('Waterfall')
  })

  // Proves long lines are cut short with an ellipsis.
  it('shortens long lines', () => {
    const line = firstLine(`<p>${'a'.repeat(200)}</p>`)
    expect(line).toHaveLength(80)
    expect(line.endsWith('…')).toBe(true)
  })

  // Proves an empty body gives an empty line.
  it('returns an empty string for an empty body', () => {
    expect(firstLine('<p></p>')).toBe('')
  })
})

describe('resolveNoteTitle', () => {
  // Proves FR-NTE-1: typed title, else first line, else "Untitled note".
  it.each([
    ['  My title ', '<p>Body</p>', 'My title'],
    ['', '<p>First line</p><p>Second</p>', 'First line'],
    ['   ', '<p></p>', 'Untitled note'],
  ])('title %j with body %j becomes %j', (title, body, expected) => {
    expect(resolveNoteTitle(title, body)).toBe(expected)
  })
})

describe('noteInputSchema', () => {
  // Proves a normal note passes and its tags are trimmed.
  it('accepts a valid note', () => {
    const result = noteInputSchema.safeParse(input({ tags: [' Question '] }))
    expect(result.success).toBe(true)
    expect(result.data?.tags).toEqual(['Question'])
  })

  // Proves FR-NTE-4: the body needs text; markup alone doesn't count.
  it('rejects an empty body', () => {
    const result = noteInputSchema.safeParse(input({ contentHtml: '<p> </p>' }))
    expect(result.error?.issues[0]?.message).toBe('Write something in your note.')
  })

  // Proves FR-NTE-4: at most 20,000 characters of text.
  it('rejects a body over the limit', () => {
    const result = noteInputSchema.safeParse(
      input({ contentHtml: `<p>${'a'.repeat(MAX_BODY_LENGTH + 1)}</p>` }),
    )
    expect(result.error?.issues[0]?.message).toMatch(/20,000/)
  })

  // Proves FR-NTE-3: at most 10 tags, each at most 30 characters, no repeats.
  it.each([
    [Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${String(i)}`), /10 tags/],
    [['x'.repeat(MAX_TAG_LENGTH + 1)], /30 characters/],
    [['Question', 'question'], /once/],
  ])('rejects tags %j', (tags, message) => {
    const result = noteInputSchema.safeParse(input({ tags }))
    expect(result.error?.issues[0]?.message).toMatch(message)
  })

  // Proves a class must be chosen (FR-NTE-1).
  it('requires a class', () => {
    const result = noteInputSchema.safeParse(input({ classId: '' }))
    expect(result.error?.issues[0]?.message).toBe('Choose the class this note is for.')
  })
})

describe('addTag', () => {
  // Proves a new tag is trimmed and added.
  it('adds a trimmed tag', () => {
    expect(addTag(['Question'], '  Exam  ')).toEqual({ tags: ['Question', 'Exam'] })
  })

  // Proves the picker explains why a tag can't be added.
  it.each([
    [[], '   ', 'Type a tag first.'],
    [['Question'], 'question', 'That tag is already added.'],
    [
      Array.from({ length: MAX_TAGS }, (_, i) => `t${String(i)}`),
      'new',
      'A note can have up to 10 tags.',
    ],
    [[], 'x'.repeat(MAX_TAG_LENGTH + 1), 'Keep tags to 30 characters or fewer.'],
  ])('refuses %j + %j', (tags, raw, error) => {
    expect(addTag(tags, raw)).toEqual({ tags, error })
  })
})

describe('textToNoteHtml', () => {
  // Proves typed text becomes paragraphs: each line one block, so the note reads as typed.
  it('turns each line into a paragraph', () => {
    expect(textToNoteHtml('Waterfall\nIterative')).toBe('<p>Waterfall</p><p>Iterative</p>')
  })

  // SECURITY: typed text is never taken as HTML, so pasted markup stays text.
  it('escapes markup', () => {
    expect(textToNoteHtml('<img src=x onerror=alert(1)> & "quotes"')).toBe(
      '<p>&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot;</p>',
    )
  })

  // Proves blank lines and edge spaces are dropped, and an empty input gives an empty body.
  it('drops blank lines and trims', () => {
    expect(textToNoteHtml('  one  \n\n   \ntwo ')).toBe('<p>one</p><p>two</p>')
    expect(textToNoteHtml('   \n ')).toBe('')
  })
})

describe('htmlToComposerText', () => {
  // Proves a saved note comes back as the lines the student typed: one line per paragraph, so
  // editing in the chat box and saving again gives the same note.
  it('gives one line per block, and survives a round trip', () => {
    const typed = 'Waterfall is linear\nChanges late are expensive'
    expect(htmlToComposerText(textToNoteHtml(typed))).toBe(typed)
  })

  // Proves rich notes from the old editor become readable lines: list items and headings each
  // get a line, and the markup is gone.
  it('flattens lists and headings from the old editor', () => {
    const html =
      '<h2>Phases</h2><p>Intro <strong>bold</strong></p><ul><li>One</li><li>Two</li></ul>'
    expect(htmlToComposerText(html)).toBe('Phases\nIntro bold\nOne\nTwo')
  })

  // Proves escaped text comes back as the characters typed, not as entities.
  it('turns escaped characters back into text', () => {
    expect(htmlToComposerText(textToNoteHtml('a < b & c'))).toBe('a < b & c')
  })

  // Proves an empty note gives an empty box.
  it('returns an empty string for no text', () => {
    expect(htmlToComposerText('')).toBe('')
    expect(htmlToComposerText('<p></p>')).toBe('')
  })
})

describe('hasRichFormatting', () => {
  // Proves formatting the chat box cannot keep is detected, so the student is told before it goes.
  it('is true for bold, lists, links and headings', () => {
    for (const html of [
      '<p><strong>x</strong></p>',
      '<p><em>x</em></p>',
      '<ul><li>x</li></ul>',
      '<ol><li>x</li></ol>',
      '<p><a href="https://x.test">x</a></p>',
      '<h2>x</h2>',
      '<blockquote><p>x</p></blockquote>',
    ]) {
      expect(hasRichFormatting(html)).toBe(true)
    }
  })

  // Proves plain paragraphs, as the chat box writes them, are not flagged.
  it('is false for plain paragraphs', () => {
    expect(hasRichFormatting(textToNoteHtml('one\ntwo'))).toBe(false)
  })
})

describe('typedTitle', () => {
  const base = { contentHtml: '<p>Waterfall is linear</p>' }

  // Proves a title the student typed is given back, so it can be edited.
  it('returns a title that differs from the first line', () => {
    expect(typedTitle({ ...base, title: 'Waterfall' })).toBe('Waterfall')
  })

  // Proves the title made from the first line is not treated as typed: it would go stale when the
  // text is edited.
  it('returns nothing for the title made from the first line, or the stand-in', () => {
    expect(typedTitle({ ...base, title: 'Waterfall is linear' })).toBe('')
    expect(typedTitle({ contentHtml: '', title: 'Untitled note' })).toBe('')
    expect(typedTitle({ ...base })).toBe('')
  })
})

describe('presetTag and otherTags', () => {
  // Proves the composer's tag is the first preset on the note, and every other tag is kept.
  it("splits a note's tags into the preset the composer shows and the others", () => {
    const note = { tags: ['spiral', 'Question', 'Example'] }
    expect(presetTag(note)).toBe('Question')
    expect(otherTags(note)).toEqual(['spiral', 'Example'])
  })

  // Proves a note with no preset tag shows none and keeps every tag.
  it('shows no preset when there is none', () => {
    expect(presetTag({ tags: ['spiral'] })).toBeNull()
    expect(otherTags({ tags: ['spiral'] })).toEqual(['spiral'])
    expect(presetTag({ tags: [] })).toBeNull()
  })
})
